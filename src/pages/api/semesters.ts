import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const parseDate = (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const semesters = await prisma.semester.findMany({
      orderBy: { startDate: "desc" },
      include: { academicYear: true },
    });
    return res.status(200).json(semesters);
  }

  if (req.method === "POST") {
    const { academicYearId, name, startDate, endDate, isActive } = req.body ?? {};

    if (typeof academicYearId !== "string" || academicYearId.trim() === "") {
      return res.status(400).json({ error: "Tahun ajaran wajib dipilih" });
    }

    if (name !== "GANJIL" && name !== "GENAP") {
      return res.status(400).json({ error: "Nama semester tidak valid" });
    }

    const parsedStart = parseDate(startDate);
    const parsedEnd = parseDate(endDate);

    if (!parsedStart || !parsedEnd) {
      return res.status(400).json({ error: "Tanggal mulai dan akhir wajib diisi" });
    }

    if (parsedStart > parsedEnd) {
      return res.status(400).json({ error: "Tanggal mulai tidak boleh setelah tanggal akhir" });
    }

    if (isActive) {
      await prisma.semester.updateMany({
        where: { academicYearId },
        data: { isActive: false },
      });
    }

    const semester = await prisma.semester.create({
      data: {
        academicYearId,
        name,
        startDate: parsedStart,
        endDate: parsedEnd,
        isActive: Boolean(isActive),
      },
      include: { academicYear: true },
    });

    return res.status(201).json(semester);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
