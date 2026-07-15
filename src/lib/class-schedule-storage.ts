import { prisma } from "@/lib/prisma";

let setupPromise: Promise<void> | null = null;

export const ensureClassScheduleTable = () => {
  if (!setupPromise) {
    setupPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ClassSchedule" (
          "id" TEXT NOT NULL,
          "classId" TEXT NOT NULL,
          "teacherId" TEXT,
          "dayOfWeek" INTEGER NOT NULL,
          "startTime" TEXT NOT NULL,
          "endTime" TEXT NOT NULL,
          CONSTRAINT "ClassSchedule_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "ClassSchedule_classId_fkey"
            FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "ClassSchedule" ADD COLUMN IF NOT EXISTS "teacherId" TEXT`,
      );
      await prisma.$executeRawUnsafe(`
        UPDATE "ClassSchedule" AS schedule
        SET "teacherId" = class."homeroomTeacherId"
        FROM "Class" AS class
        WHERE schedule."classId" = class."id"
          AND schedule."teacherId" IS NULL
          AND class."homeroomTeacherId" IS NOT NULL
      `);
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "ClassSchedule_classId_dayOfWeek_key"`);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "ClassSchedule_classId_dayOfWeek_startTime_endTime_key" ON "ClassSchedule"("classId", "dayOfWeek", "startTime", "endTime")`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ClassSchedule_classId_idx" ON "ClassSchedule"("classId")`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ClassSchedule_teacherId_dayOfWeek_idx" ON "ClassSchedule"("teacherId", "dayOfWeek")`,
      );
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ClassSchedule_teacherId_fkey'
          ) THEN
            ALTER TABLE "ClassSchedule"
            ADD CONSTRAINT "ClassSchedule_teacherId_fkey"
            FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END
        $$;
      `);
    })();
  }
  return setupPromise;
};
