import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    return res.status(400).json({ error: "ID kelas tidak valid" });
  }

  const existing = await prisma.class.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return res.status(404).json({ error: "Kelas tidak ditemukan" });
  }

  if (req.method === "PATCH") {
    const { homeroomTeacherId, studentIds } = req.body ?? {};
    const updateData: { homeroomTeacherId?: string | null } = {};

    if (homeroomTeacherId === null) {
      updateData.homeroomTeacherId = null;
    } else if (typeof homeroomTeacherId === "string" && homeroomTeacherId.trim() !== "") {
      const teacher = await prisma.teacher.findUnique({
        where: { id: homeroomTeacherId },
        select: { id: true },
      });
      if (!teacher) {
        return res.status(404).json({ error: "Wali kelas tidak ditemukan" });
      }
      updateData.homeroomTeacherId = homeroomTeacherId;
    }

    const ids = Array.isArray(studentIds)
      ? studentIds.filter((value: unknown) => typeof value === "string")
      : [];

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.class.update({ where: { id }, data: updateData });
      }

      if (ids.length > 0) {
        await tx.student.updateMany({
          where: { id: { in: ids }, classId: null },
          data: { classId: id },
        });
      }
    });

    const updated = await prisma.class.findUnique({
      where: { id },
      include: {
        academicYear: true,
        semester: true,
        homeroomTeacher: true,
        _count: { select: { students: true } },
      },
    });

    return res.status(200).json(updated);
  }

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.attendance.updateMany({ where: { classId: id }, data: { classId: null } });
      await tx.student.updateMany({ where: { classId: id }, data: { classId: null } });
      await tx.class.delete({ where: { id } });
    });
  } catch (error) {
    const maybeError = error as { code?: string };
    if (maybeError?.code === "P2011") {
      return res.status(400).json({
        error: "Kolom kelas masih wajib di database. Jalankan prisma:migrate terlebih dahulu.",
      });
    }
    if (maybeError?.code === "P2003") {
      return res.status(409).json({ error: "Kelas masih terhubung dengan data lain." });
    }
    console.error("DELETE_CLASS_FAILED", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    return res
      .status(500)
      .json({ error: "Gagal menghapus kelas", detail: process.env.NODE_ENV === "development" ? detail : undefined });
  }

  return res.status(204).end();
}
