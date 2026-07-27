import { prisma } from "@/lib/prisma";

/**
 * Kelas lama di database masih terhubung ke tahun ajaran dan semester.
 * Aplikasi bimbel tidak menampilkan konsep tersebut, tetapi relasi internal
 * ini dipertahankan agar data lama tetap aman dan pembuatan kelas baru tetap berhasil.
 */
export const getOperationalClassPeriod = async () => {
  let academicYear = await prisma.academicYear.findFirst({
    where: { isActive: true },
    orderBy: { startDate: "desc" },
  });

  if (!academicYear) {
    academicYear = await prisma.academicYear.findFirst({ orderBy: { startDate: "desc" } });
  }

  if (!academicYear) {
    const currentYear = new Date().getFullYear();
    academicYear = await prisma.academicYear.create({
      data: {
        name: "Operasional Bimbel",
        startDate: new Date(currentYear, 0, 1),
        endDate: new Date(currentYear, 11, 31),
        isActive: true,
      },
    });
  }

  let semester = await prisma.semester.findFirst({
    where: { academicYearId: academicYear.id },
    orderBy: { startDate: "asc" },
  });

  if (!semester) {
    semester = await prisma.semester.create({
      data: {
        academicYearId: academicYear.id,
        name: "GANJIL",
        startDate: academicYear.startDate,
        endDate: academicYear.endDate,
        isActive: true,
      },
    });
  }

  return { academicYearId: academicYear.id, semesterId: semester.id };
};
