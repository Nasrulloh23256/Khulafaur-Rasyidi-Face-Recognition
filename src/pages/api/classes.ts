import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { getOperationalClassPeriod } from "@/lib/class-period";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const classes = await prisma.class.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        homeroomTeacher: { select: { id: true, fullName: true } },
        _count: { select: { students: true } },
      },
    });

    return res.status(200).json(classes);
  }

  if (req.method === "POST") {
    const { name, homeroomTeacherId } = req.body ?? {};

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Nama kelas wajib diisi" });
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
      const period = await getOperationalClassPeriod();
      const createdClass = await prisma.class.create({
        data: {
          name: name.trim(),
          academicYearId: period.academicYearId,
          semesterId: period.semesterId,
          homeroomTeacherId: resolvedTeacherId,
        },
        select: {
          id: true,
          name: true,
          homeroomTeacher: { select: { id: true, fullName: true } },
          _count: { select: { students: true } },
        },
      });

      return res.status(201).json(createdClass);
    } catch (error) {
      const maybeError = error as { code?: string };
      if (maybeError?.code === "P2002") {
        return res.status(409).json({ error: "Nama kelas sudah terdaftar" });
      }
      return res.status(500).json({ error: "Gagal menyimpan kelas" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
