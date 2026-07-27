import { prisma } from "@/lib/prisma";

let ensureTablePromise: Promise<void> | null = null;

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

export const serializeTeacherAttendance = (
  attendance:
    | {
        id: string;
        date: Date;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        notes: string | null;
      }
    | null
    | undefined,
) => {
  if (!attendance) return null;
  return {
    id: attendance.id,
    date: attendance.date.toISOString(),
    checkInTime: formatTeacherAttendanceTime(attendance.checkInTime),
    checkOutTime: formatTeacherAttendanceTime(attendance.checkOutTime),
    notes: attendance.notes,
  };
};

export const ensureTeacherAttendanceTable = async () => {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TeacherAttendance" (
          "id" TEXT NOT NULL,
          "teacherId" TEXT NOT NULL,
          "date" TIMESTAMP(3) NOT NULL,
          "checkInTime" TIMESTAMP(3),
          "checkOutTime" TIMESTAMP(3),
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "TeacherAttendance_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "TeacherAttendance_date_idx" ON "TeacherAttendance"("date")`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "TeacherAttendance_teacherId_date_idx" ON "TeacherAttendance"("teacherId", "date")`,
      );
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'TeacherAttendance_teacherId_fkey'
          ) THEN
            ALTER TABLE "TeacherAttendance"
            ADD CONSTRAINT "TeacherAttendance_teacherId_fkey"
            FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
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
