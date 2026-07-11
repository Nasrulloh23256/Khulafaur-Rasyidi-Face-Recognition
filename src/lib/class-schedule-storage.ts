import { prisma } from "@/lib/prisma";

let setupPromise: Promise<void> | null = null;

export const ensureClassScheduleTable = () => {
  if (!setupPromise) {
    setupPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ClassSchedule" (
          "id" TEXT NOT NULL,
          "classId" TEXT NOT NULL,
          "dayOfWeek" INTEGER NOT NULL,
          "startTime" TEXT NOT NULL,
          "endTime" TEXT NOT NULL,
          CONSTRAINT "ClassSchedule_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "ClassSchedule_classId_fkey"
            FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "ClassSchedule_classId_dayOfWeek_key" ON "ClassSchedule"("classId", "dayOfWeek")`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ClassSchedule_classId_idx" ON "ClassSchedule"("classId")`,
      );
    })();
  }
  return setupPromise;
};
