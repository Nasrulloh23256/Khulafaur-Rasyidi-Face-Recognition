import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const classes = await prisma.class.findMany({
      orderBy: { name: "asc" },
      include: {
        academicYear: true,
        homeroomTeacher: true,
        _count: { select: { students: true } },
      },
    });

    return res.status(200).json(classes);
  }

  if (req.method === "POST") {
    const { name, academicYearId, homeroomTeacherId } = req.body ?? {};

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Nama kelas wajib diisi" });
    }

    if (typeof academicYearId !== "string" || academicYearId.trim() === "") {
      return res.status(400).json({ error: "Tahun ajaran wajib dipilih" });
    }

    let resolvedTeacherId: string | null = null;
    if (typeof homeroomTeacherId === "string" && homeroomTeacherId.trim() !== "") {
      resolvedTeacherId = homeroomTeacherId;
      const teacherExists = await prisma.teacher.findUnique({
        where: { id: resolvedTeacherId },
        select: { id: true },
      });
      if (!teacherExists) {
        return res.status(404).json({ error: "Wali kelas tidak ditemukan" });
      }
    }

    try {
      const createdClass = await prisma.class.create({
        data: {
          name: name.trim(),
          academicYearId,
          homeroomTeacherId: resolvedTeacherId,
        },
        include: {
          academicYear: true,
          homeroomTeacher: true,
          _count: { select: { students: true } },
        },
      });

      return res.status(201).json(createdClass);
    } catch (error) {
      const maybeError = error as { code?: string };
      if (maybeError?.code === "P2002") {
        return res.status(409).json({ error: "Kelas sudah terdaftar untuk tahun ajaran tersebut" });
      }
      return res.status(500).json({ error: "Gagal menyimpan kelas" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
