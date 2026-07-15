import { prisma } from "@/lib/prisma";
import { getAttendanceAreaStatus } from "@/lib/attendance-area";
import { ensureClassScheduleTable } from "@/lib/class-schedule-storage";

let ensureTablePromise: Promise<void> | null = null;

export type TeacherSessionSchedule = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export const getDateKey = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

export const parseDateKey = (value: unknown) => {
  const dateKey = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getDateKey();
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const formatDateKey = (value: Date) => value.toISOString().slice(0, 10);

export const getScheduleDayOfWeek = (date: Date) => {
  const utcDay = date.getUTCDay();
  return utcDay === 0 ? 6 : utcDay - 1;
};

const timeToMinutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

export const getTeacherSessionWindow = (schedule: TeacherSessionSchedule, date: Date) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const startMinutes = timeToMinutes(schedule.startTime);
  const endMinutes = timeToMinutes(schedule.endTime);
  const start = new Date(Date.UTC(year, month, day, Math.floor(startMinutes / 60) - 7, startMinutes % 60));
  const end = new Date(Date.UTC(year, month, day, Math.floor(endMinutes / 60) - 7, endMinutes % 60));
  return { start, end };
};

export const getTeacherSessionAvailability = (
  schedule: TeacherSessionSchedule,
  date: Date,
  now = new Date(),
) => {
  const { start, end } = getTeacherSessionWindow(schedule, date);
  const checkInStarts = new Date(start.getTime() - 30 * 60 * 1000);
  const checkOutEnds = new Date(end.getTime() + 2 * 60 * 60 * 1000);
  const isToday = formatDateKey(date) === getDateKey(now);

  if (!isToday) {
    return {
      isToday: false,
      isOpen: false,
      canCheckIn: false,
      canCheckOut: false,
      message: "Absensi sesi hanya dapat dilakukan pada hari jadwal.",
    };
  }

  if (now < checkInStarts) {
    return {
      isToday: true,
      isOpen: false,
      canCheckIn: false,
      canCheckOut: false,
      message: `Absensi datang dibuka pukul ${schedule.startTime} WIB.`,
    };
  }

  return {
    isToday: true,
    isOpen: now <= checkOutEnds,
    canCheckIn: now >= checkInStarts && now <= end,
    canCheckOut: now >= start && now <= checkOutEnds,
    message:
      now > checkOutEnds
        ? `Sesi ${schedule.startTime}-${schedule.endTime} WIB telah ditutup.`
        : `Sesi ${schedule.startTime}-${schedule.endTime} WIB aktif.`,
  };
};

export const formatTeacherAttendanceTime = (value: Date | null | undefined) => {
  if (!value) return null;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(value)
    .replace(".", ":");
};

type SerializedSchedule = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  class?: { id: string; name: string } | null;
};

type SerializableTeacherAttendance = {
  id: string;
  date: Date;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  checkInLatitude?: number | null;
  checkInLongitude?: number | null;
  checkInAccuracy?: number | null;
  checkInPhotoUrl?: string | null;
  checkOutLatitude?: number | null;
  checkOutLongitude?: number | null;
  checkOutAccuracy?: number | null;
  checkOutPhotoUrl?: string | null;
  notes: string | null;
  classSchedule?: SerializedSchedule | null;
};

export const getTeacherAttendanceStatus = (
  attendance: Pick<SerializableTeacherAttendance, "checkInTime" | "checkOutTime"> | null | undefined,
) => {
  if (!attendance?.checkInTime) return "BELUM_ABSEN" as const;
  if (!attendance.checkOutTime) return "SUDAH_DATANG" as const;
  return "SELESAI" as const;
};

export const serializeTeacherAttendance = (attendance: SerializableTeacherAttendance | null | undefined) => {
  if (!attendance) return null;
  const checkInLocation =
    typeof attendance.checkInLatitude === "number" && typeof attendance.checkInLongitude === "number"
      ? {
          latitude: attendance.checkInLatitude,
          longitude: attendance.checkInLongitude,
          accuracy: attendance.checkInAccuracy ?? null,
        }
      : null;
  const checkOutLocation =
    typeof attendance.checkOutLatitude === "number" && typeof attendance.checkOutLongitude === "number"
      ? {
          latitude: attendance.checkOutLatitude,
          longitude: attendance.checkOutLongitude,
          accuracy: attendance.checkOutAccuracy ?? null,
        }
      : null;

  return {
    id: attendance.id,
    date: attendance.date.toISOString(),
    checkInTime: formatTeacherAttendanceTime(attendance.checkInTime),
    checkOutTime: formatTeacherAttendanceTime(attendance.checkOutTime),
    checkInLocation,
    checkInAreaStatus: getAttendanceAreaStatus(checkInLocation),
    checkInPhotoUrl: attendance.checkInPhotoUrl ?? null,
    checkOutLocation,
    checkOutAreaStatus: getAttendanceAreaStatus(checkOutLocation),
    checkOutPhotoUrl: attendance.checkOutPhotoUrl ?? null,
    notes: attendance.notes,
    session: attendance.classSchedule
      ? {
          id: attendance.classSchedule.id,
          classId: attendance.classSchedule.class?.id ?? null,
          className: attendance.classSchedule.class?.name ?? "Jadwal lama",
          dayOfWeek: attendance.classSchedule.dayOfWeek,
          startTime: attendance.classSchedule.startTime,
          endTime: attendance.classSchedule.endTime,
        }
      : null,
  };
};

export const ensureTeacherAttendanceTable = async () => {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await ensureClassScheduleTable();
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TeacherAttendance" (
          "id" TEXT NOT NULL,
          "teacherId" TEXT NOT NULL,
          "classScheduleId" TEXT,
          "date" TIMESTAMP(3) NOT NULL,
          "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
          "checkInTime" TIMESTAMP(3),
          "checkOutTime" TIMESTAMP(3),
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "TeacherAttendance_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(`ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "classScheduleId" TEXT`);
      await prisma.$executeRawUnsafe(`
        WITH single_schedule AS (
          SELECT attendance."id" AS "attendanceId", MIN(schedule."id") AS "scheduleId"
          FROM "TeacherAttendance" AS attendance
          JOIN "ClassSchedule" AS schedule
            ON schedule."teacherId" = attendance."teacherId"
           AND schedule."dayOfWeek" = EXTRACT(ISODOW FROM attendance."date")::INTEGER - 1
          WHERE attendance."classScheduleId" IS NULL
          GROUP BY attendance."id"
          HAVING COUNT(schedule."id") = 1
        )
        UPDATE "TeacherAttendance" AS attendance
        SET "classScheduleId" = single_schedule."scheduleId"
        FROM single_schedule
        WHERE attendance."id" = single_schedule."attendanceId"
      `);
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "TeacherAttendance_teacherId_date_key"`);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "TeacherAttendance_teacherId_classScheduleId_date_key" ON "TeacherAttendance"("teacherId", "classScheduleId", "date")`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "TeacherAttendance_date_idx" ON "TeacherAttendance"("date")`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "TeacherAttendance_teacherId_date_idx" ON "TeacherAttendance"("teacherId", "date")`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "TeacherAttendance_classScheduleId_date_idx" ON "TeacherAttendance"("classScheduleId", "date")`,
      );
      await prisma.$executeRawUnsafe(`ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "faceEmbedding" JSONB`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "faceImageUrl" TEXT`);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT'`,
      );
      await prisma.$executeRawUnsafe(`ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "checkInLatitude" DOUBLE PRECISION`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "checkInLongitude" DOUBLE PRECISION`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "checkInAccuracy" DOUBLE PRECISION`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "checkInPhotoUrl" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "checkOutLatitude" DOUBLE PRECISION`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "checkOutLongitude" DOUBLE PRECISION`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "checkOutAccuracy" DOUBLE PRECISION`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "checkOutPhotoUrl" TEXT`);
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherAttendance_teacherId_fkey') THEN
            ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_teacherId_fkey"
              FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherAttendance_classScheduleId_fkey') THEN
            ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_classScheduleId_fkey"
              FOREIGN KEY ("classScheduleId") REFERENCES "ClassSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END
        $$;
      `);
    })().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return ensureTablePromise;
};
