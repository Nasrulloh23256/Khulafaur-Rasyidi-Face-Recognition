import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { getAttendanceAreaStatus } from "@/lib/attendance-area";
import { formatStudentAttendanceTime } from "@/lib/student-attendance";
import { sendStudentAttendanceWhatsApp } from "@/lib/whatsapp";

type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

const getHeaderValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const getRequestBaseUrl = (req: NextApiRequest) => {
  const configuredUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const host =
    getHeaderValue(req.headers["x-forwarded-host"]) ??
    getHeaderValue(req.headers.host) ??
    process.env.VERCEL_URL;
  if (!host) return "";

  const protocol = getHeaderValue(req.headers["x-forwarded-proto"]) ?? (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`.replace(/\/$/, "");
};

const buildMapsUrl = (location: AttendanceLocation) =>
  `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

const formatAreaStatus = (location: AttendanceLocation) => {
  const areaStatus = getAttendanceAreaStatus(location);
  if (!areaStatus) return "-";
  return `${areaStatus.label} (${areaStatus.distanceMeters} m dari bimbel, radius ${areaStatus.radiusMeters} m)`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const attendanceId = typeof req.body?.attendanceId === "string" ? req.body.attendanceId : "";
  if (!attendanceId) {
    return res.status(400).json({ error: "Data absensi tidak valid" });
  }

  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    select: {
      id: true,
      status: true,
      checkInTime: true,
      checkInLatitude: true,
      checkInLongitude: true,
      checkInAccuracy: true,
      student: { select: { fullName: true, guardianPhone: true } },
      class: { select: { name: true } },
    },
  });

  if (!attendance || attendance.status !== "PRESENT" || !attendance.checkInTime) {
    return res.status(400).json({ error: "Hanya absensi hadir yang dapat dikirimkan notifikasinya" });
  }

  if (attendance.checkInLatitude === null || attendance.checkInLongitude === null) {
    return res.status(400).json({ error: "Lokasi absensi tidak tersedia" });
  }

  const location: AttendanceLocation = {
    latitude: attendance.checkInLatitude,
    longitude: attendance.checkInLongitude,
    accuracy: attendance.checkInAccuracy,
  };
  const baseUrl = getRequestBaseUrl(req);
  const notification = await sendStudentAttendanceWhatsApp({
    to: attendance.student.guardianPhone,
    studentName: attendance.student.fullName,
    className: attendance.class?.name ?? "-",
    checkInTime: formatStudentAttendanceTime(attendance.checkInTime) ?? "-",
    areaStatus: formatAreaStatus(location),
    photoUrl: baseUrl ? `${baseUrl}/api/attendance/photo/${attendance.id}` : "-",
    mapsUrl: buildMapsUrl(location),
    latitude: location.latitude,
    longitude: location.longitude,
  });

  if (notification.sent === false && notification.skipped === false) {
    console.warn("Gagal mengirim ulang notifikasi WhatsApp absensi siswa:", notification.reason);
  }

  return res.status(200).json({ notification });
}
