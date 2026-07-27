CREATE TABLE IF NOT EXISTS "ClassSchedule" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "ClassSchedule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClassSchedule_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClassSchedule_classId_dayOfWeek_key"
  ON "ClassSchedule"("classId", "dayOfWeek");

CREATE INDEX IF NOT EXISTS "ClassSchedule_classId_idx"
  ON "ClassSchedule"("classId");
