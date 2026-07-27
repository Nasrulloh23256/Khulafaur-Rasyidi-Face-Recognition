ALTER TABLE "Class" DROP CONSTRAINT IF EXISTS "Class_semesterId_fkey";

DROP INDEX IF EXISTS "Class_name_academicYearId_semesterId_key";
DROP INDEX IF EXISTS "Class_academicYearId_semesterId_idx";

ALTER TABLE "Class" ALTER COLUMN "semesterId" DROP NOT NULL;

ALTER TABLE "Class"
ADD CONSTRAINT "Class_semesterId_fkey"
FOREIGN KEY ("semesterId") REFERENCES "Semester"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Class_academicYearId_idx" ON "Class"("academicYearId");
