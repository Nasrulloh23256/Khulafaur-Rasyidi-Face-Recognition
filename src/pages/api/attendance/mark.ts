import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { getAttendanceAreaStatus } from "@/lib/attendance-area";
import { saveBase64Image } from "@/lib/image-storage";
import { ensureStudentAttendanceColumns, formatStudentAttendanceTime } from "@/lib/student-attendance";
import { sendStudentAttendanceWhatsApp } from "@/lib/whatsapp";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
  },
};

type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const allowedStatus = ["PRESENT", "ABSENT", "SICK", "PERMIT"] as const;

const normalizeLocation = (value: unknown): AttendanceLocation | null => {
  if (!value || typeof value !== "object") return null;
  const location = value as { latitude?: unknown; longitude?: unknown; accuracy?: unknown };
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const accuracy = location.accuracy === null || location.accuracy === undefined ? null : Number(location.accuracy);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) return null;

  return { latitude, longitude, accuracy };
};

const saveAttendancePhoto = async (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("INVALID_FORMAT");
  }
  return saveBase64Image(value.trim(), { folder: "uploads/student-attendance" });
};

const getHeaderValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const getRequestBaseUrl = (req: NextApiRequest) => {
  const configuredUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const host =
    getHeaderValue(req.headers["x-forwarded-host"]) ??
    getHeaderValue(req.headers.host) ??
    process.env.VERCEL_URL;
  if (!host) return "";

  const protocol = getHeaderValue(req.headers["x-forwarded-proto"]) ?? (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`.replace(/\/$/, "");
};

const buildPhotoUrl = (req: NextApiRequest, attendanceId: string) => {
  const baseUrl = getRequestBaseUrl(req);
  return baseUrl ? `${baseUrl}/api/attendance/photo/${attendanceId}` : "";
};

const buildMapsUrl = (location: AttendanceLocation) =>
  `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

const formatAreaStatus = (location: AttendanceLocation) => {
  const areaStatus = getAttendanceAreaStatus(location);
  if (!areaStatus) return "-";
  return `${areaStatus.label} (${areaStatus.distanceMeters} m dari bimbel, radius ${areaStatus.radiusMeters} m)`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureStudentAttendanceColumns();

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { studentId, classId, status, photo, location } = req.body ?? {};

  if (typeof studentId !== "string" || studentId.trim() === "") {
    return res.status(400).json({ error: "Siswa tidak valid" });
  }

  if (typeof classId !== "string" || classId.trim() === "") {
    return res.status(400).json({ error: "Kelas wajib dipilih" });
  }

  const resolvedStatus =
    typeof status === "string" && allowedStatus.includes(status as typeof allowedStatus[number])
      ? (status as typeof allowedStatus[number])
      : "PRESENT";

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      classId: true,
      fullName: true,
      guardianPhone: true,
    },
  });

  if (!student) {
    return res.status(404).json({ error: "Siswa tidak ditemukan" });
  }

  if (student.classId !== classId) {
    return res.status(400).json({ error: "Siswa tidak berada di kelas ini" });
  }

  const kelas = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true } });
  if (!kelas) {
    return res.status(404).json({ error: "Kelas tidak ditemukan" });
  }

  const date = startOfDay(new Date());

  const existing = await prisma.attendance.findUnique({
    where: { studentId_date: { studentId, date } },
    select: { id: true },
  });

  if (existing) {
    return res.status(409).json({ error: "Siswa sudah absen hari ini" });
  }

  const isPresent = resolvedStatus === "PRESENT";
  const attendanceLocation = isPresent ? normalizeLocation(location) : null;
  if (isPresent && !attendanceLocation) {
    return res.status(400).json({ error: "Lokasi absensi wajib diaktifkan dan harus valid" });
  }

  let photoUrl: string | null = null;
  if (isPresent) {
    try {
      photoUrl = await saveAttendancePhoto(photo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "INVALID_IMAGE";
      if (message === "IMAGE_TOO_LARGE") {
        return res.status(413).json({ error: "Ukuran foto maksimal 2MB" });
      }
      return res.status(400).json({ error: "Foto absensi wajib diambil dari kamera" });
    }
  }

  let attendance;
  try {
    attendance = await prisma.attendance.create({
      data: {
        studentId,
        classId,
        status: resolvedStatus,
        date,
        checkInTime: isPresent ? new Date() : null,
        checkInLatitude: attendanceLocation?.latitude ?? null,
        checkInLongitude: attendanceLocation?.longitude ?? null,
        checkInAccuracy: attendanceLocation?.accuracy ?? null,
        checkInPhotoUrl: photoUrl,
      },
    });
  } catch (error) {
    const maybeError = error as { code?: string };
    if (maybeError?.code === "P2002") {
      return res.status(409).json({ error: "Siswa sudah absen hari ini" });
    }
    return res.status(500).json({ error: "Gagal menyimpan absensi" });
  }

  let whatsappNotification = null;
  if (isPresent && attendanceLocation) {
    whatsappNotification = await sendStudentAttendanceWhatsApp({
      to: student.guardianPhone,
      studentName: student.fullName,
      className: kelas.name,
      checkInTime: formatStudentAttendanceTime(attendance.checkInTime) ?? "-",
      areaStatus: formatAreaStatus(attendanceLocation),
      photoUrl: buildPhotoUrl(req, attendance.id),
      mapsUrl: buildMapsUrl(attendanceLocation),
      latitude: attendanceLocation.latitude,
      longitude: attendanceLocation.longitude,
    });

    if (!whatsappNotification.sent && !whatsappNotification.skipped) {
      console.warn("Gagal mengirim notifikasi WhatsApp absensi siswa:", whatsappNotification.reason);
    }
  }

  return res.status(200).json({ ...attendance, whatsappNotification });
}
