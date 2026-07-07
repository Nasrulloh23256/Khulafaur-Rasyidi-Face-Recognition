import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import {
  ensureTeacherAttendanceTable,
  parseDateKey,
  serializeTeacherAttendance,
} from "@/lib/teacher-attendance";
import { saveBase64Image } from "@/lib/image-storage";

type AttendanceAction = "check-in" | "check-out";
type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
  },
};

const getStatus = (attendance: { checkInTime: Date | null; checkOutTime: Date | null } | null | undefined) => {
  if (!attendance?.checkInTime) return "BELUM_ABSEN";
  if (!attendance.checkOutTime) return "SUDAH_DATANG";
  return "SELESAI";
};

const normalizeLocation = (value: unknown): AttendanceLocation | null => {
  if (!value || typeof value !== "object") return null;
  const location = value as { latitude?: unknown; longitude?: unknown; accuracy?: unknown };
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const accuracy = location.accuracy === null || location.accuracy === undefined ? null : Number(location.accuracy);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) return null;

  return {
    latitude,
    longitude,
    accuracy,
  };
};

const attendanceSelect = {
  id: true,
  date: true,
  checkInTime: true,
  checkOutTime: true,
  checkInLatitude: true,
  checkInLongitude: true,
  checkInAccuracy: true,
  checkInPhotoUrl: true,
  checkOutLatitude: true,
  checkOutLongitude: true,
  checkOutAccuracy: true,
  checkOutPhotoUrl: true,
  notes: true,
};

const findTeacherByUserId = async (userId: string) =>
  prisma.teacher.findUnique({
    where: { userId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      user: { select: { email: true } },
      classes: { select: { id: true, name: true } },
    },
  });

const buildTeacherPayload = (teacher: NonNullable<Awaited<ReturnType<typeof findTeacherByUserId>>>) => ({
  id: teacher.id,
  fullName: teacher.fullName,
  phone: teacher.phone,
  email: teacher.user?.email ?? null,
  classes: teacher.classes,
});

const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const formatDateKey = (value: Date) => value.toISOString().slice(0, 10);

const addUtcDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

const getRangeDateKeys = (start: Date, end: Date) => {
  const dates: string[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addUtcDays(cursor, 1)) {
    dates.push(formatDateKey(cursor));
  }
  return dates;
};

const buildRangeRecap = async (start: Date, end: Date) => {
  const dateKeys = getRangeDateKeys(start, end);
  const teachers = await prisma.teacher.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      phone: true,
      user: { select: { email: true } },
      classes: { select: { id: true, name: true } },
      teacherAttendances: {
        where: { date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
        select: attendanceSelect,
      },
    },
  });

  let presentSlots = 0;
  let completeSlots = 0;
  let missingCheckOut = 0;

  const rows = teachers.map((teacher) => {
    const attendanceByDate = new Map(
      teacher.teacherAttendances.map((attendance) => [formatDateKey(attendance.date), attendance]),
    );
    const daily = dateKeys.map((dateKey) => {
      const attendance = attendanceByDate.get(dateKey) ?? null;
      const serialized = serializeTeacherAttendance(attendance);
      const status = getStatus(attendance);

      if (status !== "BELUM_ABSEN") presentSlots += 1;
      if (status === "SELESAI") completeSlots += 1;
      if (status === "SUDAH_DATANG") missingCheckOut += 1;

      return {
        date: dateKey,
        checkInTime: serialized?.checkInTime ?? null,
        checkOutTime: serialized?.checkOutTime ?? null,
        checkInLocation: serialized?.checkInLocation ?? null,
        checkOutLocation: serialized?.checkOutLocation ?? null,
        checkInPhotoUrl: serialized?.checkInPhotoUrl ?? null,
        checkOutPhotoUrl: serialized?.checkOutPhotoUrl ?? null,
        status,
      };
    });

    const present = daily.filter((item) => item.status !== "BELUM_ABSEN").length;
    const complete = daily.filter((item) => item.status === "SELESAI").length;
    const missingOut = daily.filter((item) => item.status === "SUDAH_DATANG").length;

    return {
      id: teacher.id,
      fullName: teacher.fullName,
      phone: teacher.phone,
      email: teacher.user?.email ?? null,
      classes: teacher.classes,
      totals: {
        present,
        complete,
        missingCheckOut: missingOut,
        absent: dateKeys.length - present,
      },
      daily,
    };
  });

  const totalSlots = teachers.length * dateKeys.length;

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    dates: dateKeys,
    stats: {
      totalTeachers: teachers.length,
      totalDays: dateKeys.length,
      totalSlots,
      presentSlots,
      completeSlots,
      missingCheckOut,
      absentSlots: totalSlots - presentSlots,
    },
    teachers: rows,
  };
};

const saveAttendancePhoto = async (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("INVALID_FORMAT");
  }
  return saveBase64Image(value.trim(), { folder: "uploads/teacher-attendance" });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureTeacherAttendanceTable();

  if (req.method === "GET") {
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";

    if (userId) {
      const date = parseDateKey(req.query.date);
      const teacher = await findTeacherByUserId(userId);
      if (!teacher) {
        return res.status(404).json({ error: "Akun guru belum terhubung dengan data pengajar" });
      }

      const [today, recent] = await Promise.all([
        prisma.teacherAttendance.findUnique({
          where: { teacherId_date: { teacherId: teacher.id, date } },
          select: attendanceSelect,
        }),
        prisma.teacherAttendance.findMany({
          where: { teacherId: teacher.id },
          orderBy: { date: "desc" },
          take: 7,
          select: attendanceSelect,
        }),
      ]);

      return res.status(200).json({
        date: date.toISOString(),
        teacher: buildTeacherPayload(teacher),
        today: serializeTeacherAttendance(today),
        status: getStatus(today),
        recent: recent.map(serializeTeacherAttendance),
      });
    }

    const hasRange = isDateKey(req.query.start) || isDateKey(req.query.end);
    if (hasRange) {
      if (!isDateKey(req.query.start) || !isDateKey(req.query.end)) {
        return res.status(400).json({ error: "Tanggal awal dan akhir wajib valid" });
      }

      const start = parseDateKey(req.query.start);
      const end = parseDateKey(req.query.end);
      if (start > end) {
        return res.status(400).json({ error: "Tanggal awal tidak boleh melewati tanggal akhir" });
      }

      const totalDays = getRangeDateKeys(start, end).length;
      if (totalDays > 366) {
        return res.status(400).json({ error: "Rentang rekap maksimal 366 hari" });
      }

      return res.status(200).json(await buildRangeRecap(start, end));
    }

    const date = parseDateKey(req.query.date);
    const teachers = await prisma.teacher.findMany({
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        phone: true,
        user: { select: { email: true } },
        classes: { select: { id: true, name: true } },
        teacherAttendances: {
          where: { date },
          take: 1,
          select: attendanceSelect,
        },
      },
    });

    const rows = teachers.map((teacher) => {
      const attendance = teacher.teacherAttendances[0] ?? null;
      return {
        id: teacher.id,
        fullName: teacher.fullName,
        phone: teacher.phone,
        email: teacher.user?.email ?? null,
        classes: teacher.classes,
        attendance: serializeTeacherAttendance(attendance),
        status: getStatus(attendance),
      };
    });

    const checkedIn = rows.filter((row) => row.status !== "BELUM_ABSEN").length;
    const checkedOut = rows.filter((row) => row.status === "SELESAI").length;

    return res.status(200).json({
      date: date.toISOString(),
      stats: {
        totalTeachers: rows.length,
        checkedIn,
        checkedOut,
        notCheckedIn: rows.length - checkedIn,
      },
      teachers: rows,
    });
  }

  if (req.method === "POST") {
    const { userId, action, date: dateValue, photo, location } = req.body ?? {};
    const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
    const resolvedAction = typeof action === "string" ? action : "";

    if (!normalizedUserId) {
      return res.status(400).json({ error: "Akun guru tidak valid" });
    }

    if (resolvedAction !== "check-in" && resolvedAction !== "check-out") {
      return res.status(400).json({ error: "Aksi absensi tidak valid" });
    }

    const teacher = await findTeacherByUserId(normalizedUserId);
    if (!teacher) {
      return res.status(404).json({ error: "Akun guru belum terhubung dengan data pengajar" });
    }

    const date = parseDateKey(dateValue);
    const now = new Date();
    const attendanceAction = resolvedAction as AttendanceAction;
    const attendanceLocation = normalizeLocation(location);
    if (!attendanceLocation) {
      return res.status(400).json({ error: "Lokasi absensi wajib diaktifkan dan harus valid" });
    }

    if (attendanceAction === "check-in") {
      const existing = await prisma.teacherAttendance.findUnique({
        where: { teacherId_date: { teacherId: teacher.id, date } },
        select: attendanceSelect,
      });

      if (existing?.checkInTime) {
        return res.status(409).json({
          error: "Pengajar sudah absen datang hari ini",
          attendance: serializeTeacherAttendance(existing),
          status: getStatus(existing),
        });
      }

      let photoUrl: string;
      try {
        photoUrl = await saveAttendancePhoto(photo);
      } catch (error) {
        const message = error instanceof Error ? error.message : "INVALID_IMAGE";
        if (message === "IMAGE_TOO_LARGE") {
          return res.status(413).json({ error: "Ukuran foto maksimal 2MB" });
        }
        return res.status(400).json({ error: "Foto absensi wajib diambil dari kamera" });
      }

      const attendance = await prisma.teacherAttendance.upsert({
        where: { teacherId_date: { teacherId: teacher.id, date } },
        create: {
          teacherId: teacher.id,
          date,
          checkInTime: now,
          checkInLatitude: attendanceLocation?.latitude ?? null,
          checkInLongitude: attendanceLocation?.longitude ?? null,
          checkInAccuracy: attendanceLocation?.accuracy ?? null,
          checkInPhotoUrl: photoUrl,
        },
        update: {
          checkInTime: now,
          checkInLatitude: attendanceLocation?.latitude ?? null,
          checkInLongitude: attendanceLocation?.longitude ?? null,
          checkInAccuracy: attendanceLocation?.accuracy ?? null,
          checkInPhotoUrl: photoUrl,
        },
        select: attendanceSelect,
      });

      return res.status(200).json({
        teacher: buildTeacherPayload(teacher),
        attendance: serializeTeacherAttendance(attendance),
        status: getStatus(attendance),
      });
    }

    const existing = await prisma.teacherAttendance.findUnique({
      where: { teacherId_date: { teacherId: teacher.id, date } },
      select: attendanceSelect,
    });

    if (!existing?.checkInTime) {
      return res.status(400).json({ error: "Absensi datang belum dicatat" });
    }

    if (existing.checkOutTime) {
      return res.status(409).json({
        error: "Pengajar sudah absen pulang hari ini",
        attendance: serializeTeacherAttendance(existing),
        status: getStatus(existing),
      });
    }

    let photoUrl: string;
    try {
      photoUrl = await saveAttendancePhoto(photo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "INVALID_IMAGE";
      if (message === "IMAGE_TOO_LARGE") {
        return res.status(413).json({ error: "Ukuran foto maksimal 2MB" });
      }
      return res.status(400).json({ error: "Foto absensi wajib diambil dari kamera" });
    }

    const attendance = await prisma.teacherAttendance.update({
      where: { id: existing.id },
      data: {
        checkOutTime: now,
        checkOutLatitude: attendanceLocation?.latitude ?? null,
        checkOutLongitude: attendanceLocation?.longitude ?? null,
        checkOutAccuracy: attendanceLocation?.accuracy ?? null,
        checkOutPhotoUrl: photoUrl,
      },
      select: attendanceSelect,
    });

    return res.status(200).json({
      teacher: buildTeacherPayload(teacher),
      attendance: serializeTeacherAttendance(attendance),
      status: getStatus(attendance),
    });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
