import { prisma } from "@/lib/prisma";

export type PayrollPeriod = "WEEKLY" | "MONTHLY";

let ensureTablePromise: Promise<void> | null = null;

export const normalizePayrollPeriod = (value: unknown): PayrollPeriod | null => {
  if (value === "WEEKLY" || value === "MONTHLY") return value;
  return null;
};

export const formatDateKey = (value: Date) => value.toISOString().slice(0, 10);

const addUtcDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

export const getPayrollRange = (period: PayrollPeriod, anchorDate: Date) => {
  if (period === "WEEKLY") {
    const day = anchorDate.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = addUtcDays(anchorDate, mondayOffset);
    const end = addUtcDays(start, 6);
    return { start, end };
  }

  const year = anchorDate.getUTCFullYear();
  const month = anchorDate.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 0)),
  };
};

export const ensureTeacherPayrollTable = async () => {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TeacherPayrollSetting" (
          "id" TEXT NOT NULL,
          "hourlyRate" INTEGER NOT NULL DEFAULT 0,
          "period" TEXT NOT NULL DEFAULT 'MONTHLY',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "TeacherPayrollSetting_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "TeacherPayrollSetting" ADD COLUMN IF NOT EXISTS "hourlyRate" INTEGER NOT NULL DEFAULT 0`,
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "TeacherPayrollSetting" ADD COLUMN IF NOT EXISTS "period" TEXT NOT NULL DEFAULT 'MONTHLY'`,
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "TeacherPayrollSetting" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "TeacherPayrollSetting" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      );
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'TeacherPayrollSetting_period_check'
          ) THEN
            ALTER TABLE "TeacherPayrollSetting"
            ADD CONSTRAINT "TeacherPayrollSetting_period_check"
            CHECK ("period" IN ('WEEKLY', 'MONTHLY'));
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

export const getTeacherPayrollSetting = async () => {
  await ensureTeacherPayrollTable();

  const existing = await prisma.teacherPayrollSetting.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing;

  return prisma.teacherPayrollSetting.create({
    data: {
      hourlyRate: 0,
      period: "MONTHLY",
    },
  });
};
