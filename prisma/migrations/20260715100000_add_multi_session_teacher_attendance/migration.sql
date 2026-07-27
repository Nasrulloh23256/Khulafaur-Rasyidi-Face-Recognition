ALTER TABLE "ClassSchedule" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;

UPDATE "ClassSchedule" AS schedule
SET "teacherId" = class."homeroomTeacherId"
FROM "Class" AS class
WHERE schedule."classId" = class."id"
  AND schedule."teacherId" IS NULL
  AND class."homeroomTeacherId" IS NOT NULL;

DROP INDEX IF EXISTS "ClassSchedule_classId_dayOfWeek_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ClassSchedule_classId_dayOfWeek_startTime_endTime_key"
  ON "ClassSchedule"("classId", "dayOfWeek", "startTime", "endTime");
CREATE INDEX IF NOT EXISTS "ClassSchedule_teacherId_dayOfWeek_idx"
  ON "ClassSchedule"("teacherId", "dayOfWeek");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClassSchedule_teacherId_fkey') THEN
    ALTER TABLE "ClassSchedule"
      ADD CONSTRAINT "ClassSchedule_teacherId_fkey"
      FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "classScheduleId" TEXT;

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
WHERE attendance."id" = single_schedule."attendanceId";

DROP INDEX IF EXISTS "TeacherAttendance_teacherId_date_key";

CREATE UNIQUE INDEX IF NOT EXISTS "TeacherAttendance_teacherId_classScheduleId_date_key"
  ON "TeacherAttendance"("teacherId", "classScheduleId", "date");
CREATE INDEX IF NOT EXISTS "TeacherAttendance_classScheduleId_date_idx"
  ON "TeacherAttendance"("classScheduleId", "date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeacherAttendance_classScheduleId_fkey') THEN
    ALTER TABLE "TeacherAttendance"
      ADD CONSTRAINT "TeacherAttendance_classScheduleId_fkey"
      FOREIGN KEY ("classScheduleId") REFERENCES "ClassSchedule"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
