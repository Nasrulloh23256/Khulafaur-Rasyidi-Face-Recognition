import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import {
  ensureTeacherAttendanceTable,
  formatDateKey,
  getScheduleDayOfWeek,
  getTeacherAttendanceStatus,
  getTeacherSessionAvailability,
  parseDateKey,
  serializeTeacherAttendance,
} from "@/lib/teacher-attendance";
import { saveBase64Image } from "@/lib/image-storage";

type AttendanceAction = "check-in" | "check-out";
type AttendanceLocation = { latitude: number; longitude: number; accuracy: number | null };

export const config = {
  api: { bodyParser: { sizeLimit: "6mb" } },
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
  classSchedule: {
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      class: { select: { id: true, name: true } },
    },
  },
} as const;

const scheduleSelect = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  class: { select: { id: true, name: true } },
} as const;

const findTeacherByUserId = (userId: string) =>
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
  if (typeof value !== "string" || value.trim() === "") throw new Error("INVALID_FORMAT");
  return saveBase64Image(value.trim(), { folder: "uploads/teacher-attendance" });
};

const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const addUtcDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

const getRangeDates = (start: Date, end: Date) => {
  const dates: Date[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addUtcDays(cursor, 1)) dates.push(cursor);
  return dates;
};

const buildSessionPayload = (
  schedule: { id: string; dayOfWeek: number; startTime: string; endTime: string; class: { id: string; name: string } },
  date: Date,
  attendance: Parameters<typeof serializeTeacherAttendance>[0],
) => ({
  id: schedule.id,
  classId: schedule.class.id,
  className: schedule.class.name,
  dayOfWeek: schedule.dayOfWeek,
  startTime: schedule.startTime,
  endTime: schedule.endTime,
  attendance: serializeTeacherAttendance(attendance),
  status: getTeacherAttendanceStatus(attendance),
  availability: getTeacherSessionAvailability(schedule, date),
});

const buildRangeRecap = async (start: Date, end: Date) => {
  const dates = getRangeDates(start, end);
  const [schedules, attendances, teachers] = await Promise.all([
    prisma.classSchedule.findMany({
      where: { teacherId: { not: null } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      select: {
        ...scheduleSelect,
        teacherId: true,
        teacher: { select: { id: true, fullName: true, phone: true, user: { select: { email: true } } } },
      },
    }),
    prisma.teacherAttendance.findMany({
      where: { date: { gte: start, lte: end }, classScheduleId: { not: null } },
      select: { ...attendanceSelect, teacherId: true, classScheduleId: true },
    }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);

  const attendanceMap = new Map(
    attendances.map((attendance) => [
      `${attendance.teacherId}-${attendance.classScheduleId}-${formatDateKey(attendance.date)}`,
      attendance,
    ]),
  );

  const sessions = dates.flatMap((date) =>
    schedules
      .filter((schedule) => schedule.dayOfWeek === getScheduleDayOfWeek(date) && schedule.teacher)
      .map((schedule) => {
        const attendance = attendanceMap.get(`${schedule.teacherId}-${schedule.id}-${formatDateKey(date)}`) ?? null;
        return {
          date: formatDateKey(date),
          teacher: schedule.teacher,
          schedule: {
            id: schedule.id,
            classId: schedule.class.id,
            className: schedule.class.name,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
          },
          attendance: serializeTeacherAttendance(attendance),
          status: getTeacherAttendanceStatus(attendance),
        };
      }),
  );

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    dates: dates.map(formatDateKey),
    teacherOptions: teachers,
    stats: {
      totalTeachers: new Set(sessions.map((item) => item.teacher?.id)).size,
      totalDays: dates.length,
      totalSlots: sessions.length,
      presentSlots: sessions.filter((item) => item.status !== "BELUM_ABSEN").length,
      completeSlots: sessions.filter((item) => item.status === "SELESAI").length,
      missingCheckOut: sessions.filter((item) => item.status === "SUDAH_DATANG").length,
      absentSlots: sessions.filter((item) => item.status === "BELUM_ABSEN").length,
    },
    sessions,
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureTeacherAttendanceTable();

  if (req.method === "GET") {
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";

    if (userId) {
      const date = parseDateKey(req.query.date);
      const teacher = await findTeacherByUserId(userId);
      if (!teacher) return res.status(404).json({ error: "Akun guru belum terhubung dengan data pengajar" });

      const [schedules, recent] = await Promise.all([
        prisma.classSchedule.findMany({
          where: { teacherId: teacher.id, dayOfWeek: getScheduleDayOfWeek(date) },
          orderBy: { startTime: "asc" },
          select: {
            ...scheduleSelect,
            teacherAttendances: {
              where: { teacherId: teacher.id, date },
              take: 1,
              select: attendanceSelect,
            },
          },
        }),
        prisma.teacherAttendance.findMany({
          where: { teacherId: teacher.id },
          orderBy: [{ date: "desc" }, { checkInTime: "desc" }],
          take: 12,
          select: attendanceSelect,
        }),
      ]);

      const sessions = schedules.map((schedule) =>
        buildSessionPayload(schedule, date, schedule.teacherAttendances[0] ?? null),
      );
      return res.status(200).json({
        date: date.toISOString(),
        teacher: buildTeacherPayload(teacher),
        sessions,
        stats: {
          totalSessions: sessions.length,
          checkedIn: sessions.filter((item) => item.status !== "BELUM_ABSEN").length,
          completed: sessions.filter((item) => item.status === "SELESAI").length,
        },
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
      if (start > end) return res.status(400).json({ error: "Tanggal awal tidak boleh melewati tanggal akhir" });
      if (getRangeDates(start, end).length > 366) {
        return res.status(400).json({ error: "Rentang rekap maksimal 366 hari" });
      }
      return res.status(200).json(await buildRangeRecap(start, end));
    }

    const date = parseDateKey(req.query.date);
    const schedules = await prisma.classSchedule.findMany({
      where: { teacherId: { not: null }, dayOfWeek: getScheduleDayOfWeek(date) },
      orderBy: [{ startTime: "asc" }, { class: { name: "asc" } }],
      select: {
        ...scheduleSelect,
        teacher: { select: { id: true, fullName: true, phone: true, user: { select: { email: true } } } },
        teacherAttendances: { where: { date }, take: 1, select: attendanceSelect },
      },
    });

    const sessions = schedules
      .filter((schedule) => schedule.teacher)
      .map((schedule) => ({
        ...buildSessionPayload(schedule, date, schedule.teacherAttendances[0] ?? null),
        teacher: schedule.teacher,
      }));
    return res.status(200).json({
      date: date.toISOString(),
      stats: {
        totalTeachers: new Set(sessions.map((item) => item.teacher?.id)).size,
        totalSessions: sessions.length,
        checkedIn: sessions.filter((item) => item.status !== "BELUM_ABSEN").length,
        checkedOut: sessions.filter((item) => item.status === "SELESAI").length,
        notCheckedIn: sessions.filter((item) => item.status === "BELUM_ABSEN").length,
      },
      sessions,
    });
  }

  if (req.method === "POST") {
    const { userId, scheduleId, action, date: dateValue, photo, location } = req.body ?? {};
    const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
    const normalizedScheduleId = typeof scheduleId === "string" ? scheduleId.trim() : "";
    const resolvedAction = typeof action === "string" ? action : "";
    if (!normalizedUserId) return res.status(400).json({ error: "Akun guru tidak valid" });
    if (!normalizedScheduleId) return res.status(400).json({ error: "Sesi mengajar wajib dipilih" });
    if (resolvedAction !== "check-in" && resolvedAction !== "check-out") {
      return res.status(400).json({ error: "Aksi absensi tidak valid" });
    }

    const teacher = await findTeacherByUserId(normalizedUserId);
    if (!teacher) return res.status(404).json({ error: "Akun guru belum terhubung dengan data pengajar" });
    const schedule = await prisma.classSchedule.findUnique({ where: { id: normalizedScheduleId }, select: scheduleSelect });
    const assignedSchedule = await prisma.classSchedule.findFirst({
      where: { id: normalizedScheduleId, teacherId: teacher.id },
      select: scheduleSelect,
    });
    if (!schedule || !assignedSchedule) {
      return res.status(403).json({ error: "Sesi ini tidak ditugaskan kepada akun pengajar" });
    }

    const date = parseDateKey(dateValue);
    if (assignedSchedule.dayOfWeek !== getScheduleDayOfWeek(date)) {
      return res.status(400).json({ error: "Hari absensi tidak sesuai dengan jadwal sesi" });
    }
    const attendanceAction = resolvedAction as AttendanceAction;
    const availability = getTeacherSessionAvailability(assignedSchedule, date);
    if (attendanceAction === "check-in" && !availability.canCheckIn) {
      return res.status(403).json({ error: availability.message });
    }
    if (attendanceAction === "check-out" && !availability.canCheckOut) {
      return res.status(403).json({ error: availability.message });
    }

    const attendanceLocation = normalizeLocation(location);
    if (!attendanceLocation) {
      return res.status(400).json({ error: "Lokasi absensi wajib diaktifkan dan harus valid" });
    }
    let photoUrl: string;
    try {
      photoUrl = await saveAttendancePhoto(photo);
    } catch (error) {
      const message = error instanceof Error ? error.message : "INVALID_IMAGE";
      if (message === "IMAGE_TOO_LARGE") return res.status(413).json({ error: "Ukuran foto maksimal 2MB" });
      return res.status(400).json({ error: "Foto absensi wajib diambil dari kamera" });
    }

    const existing = await prisma.teacherAttendance.findFirst({
      where: { teacherId: teacher.id, classScheduleId: assignedSchedule.id, date },
      select: attendanceSelect,
    });
    const now = new Date();

    if (attendanceAction === "check-in") {
      if (existing?.checkInTime) {
        return res.status(409).json({ error: "Absensi datang untuk sesi ini sudah tercatat" });
      }
      const attendance = existing
        ? await prisma.teacherAttendance.update({
            where: { id: existing.id },
            data: {
              checkInTime: now,
              checkInLatitude: attendanceLocation.latitude,
              checkInLongitude: attendanceLocation.longitude,
              checkInAccuracy: attendanceLocation.accuracy,
              checkInPhotoUrl: photoUrl,
            },
            select: attendanceSelect,
          })
        : await prisma.teacherAttendance.create({
            data: {
              teacherId: teacher.id,
              classScheduleId: assignedSchedule.id,
              date,
              checkInTime: now,
              checkInLatitude: attendanceLocation.latitude,
              checkInLongitude: attendanceLocation.longitude,
              checkInAccuracy: attendanceLocation.accuracy,
              checkInPhotoUrl: photoUrl,
            },
            select: attendanceSelect,
          });
      return res.status(200).json({ attendance: serializeTeacherAttendance(attendance), status: getTeacherAttendanceStatus(attendance) });
    }

    if (!existing?.checkInTime) return res.status(400).json({ error: "Absensi datang sesi ini belum dicatat" });
    if (existing.checkOutTime) return res.status(409).json({ error: "Absensi pulang untuk sesi ini sudah tercatat" });
    const attendance = await prisma.teacherAttendance.update({
      where: { id: existing.id },
      data: {
        checkOutTime: now,
        checkOutLatitude: attendanceLocation.latitude,
        checkOutLongitude: attendanceLocation.longitude,
        checkOutAccuracy: attendanceLocation.accuracy,
        checkOutPhotoUrl: photoUrl,
      },
      select: attendanceSelect,
    });
    return res.status(200).json({ attendance: serializeTeacherAttendance(attendance), status: getTeacherAttendanceStatus(attendance) });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
