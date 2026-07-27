import { prisma } from "@/lib/prisma";
import { getAttendanceAreaStatus } from "@/lib/attendance-area";

let ensureColumnsPromise: Promise<void> | null = null;

export const ensureStudentAttendanceColumns = async () => {
  if (!ensureColumnsPromise) {
    ensureColumnsPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "checkInLatitude" DOUBLE PRECISION`,
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "checkInLongitude" DOUBLE PRECISION`,
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "checkInAccuracy" DOUBLE PRECISION`,
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "checkInPhotoUrl" TEXT`,
      );
    })().catch((error) => {
      ensureColumnsPromise = null;
      throw error;
    });
  }

  return ensureColumnsPromise;
};

export const formatStudentAttendanceTime = (value: Date | null | undefined) => {
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

export const serializeStudentAttendanceLocation = (
  attendance:
    | {
        checkInLatitude?: number | null;
        checkInLongitude?: number | null;
        checkInAccuracy?: number | null;
      }
    | null
    | undefined,
) => {
  if (
    !attendance ||
    typeof attendance.checkInLatitude !== "number" ||
    typeof attendance.checkInLongitude !== "number"
  ) {
    return null;
  }

  return {
    latitude: attendance.checkInLatitude,
    longitude: attendance.checkInLongitude,
    accuracy: attendance.checkInAccuracy ?? null,
  };
};

export const serializeStudentAttendanceAreaStatus = (
  attendance:
    | {
        checkInLatitude?: number | null;
        checkInLongitude?: number | null;
      }
    | null
    | undefined,
) => getAttendanceAreaStatus(serializeStudentAttendanceLocation(attendance));
