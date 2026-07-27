CREATE TABLE "TeacherPayrollSetting" (
    "id" TEXT NOT NULL,
    "hourlyRate" INTEGER NOT NULL DEFAULT 0,
    "period" TEXT NOT NULL DEFAULT 'MONTHLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherPayrollSetting_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeacherPayrollSetting_period_check" CHECK ("period" IN ('WEEKLY', 'MONTHLY'))
);
