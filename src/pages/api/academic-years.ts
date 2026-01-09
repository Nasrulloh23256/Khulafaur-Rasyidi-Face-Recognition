import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const parseDate = (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const years = await prisma.academicYear.findMany({
      orderBy: { startDate: "desc" },
    });
    return res.status(200).json(years);
  }

  if (req.method === "POST") {
    const { name, startDate, endDate, isActive } = req.body ?? {};

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Nama tahun ajaran wajib diisi" });
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
      await prisma.academicYear.updateMany({ data: { isActive: false } });
    }

    const year = await prisma.academicYear.create({
      data: {
        name: name.trim(),
        startDate: parsedStart,
        endDate: parsedEnd,
        isActive: Boolean(isActive),
      },
    });

    return res.status(201).json(year);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
