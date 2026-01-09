import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    return res.status(400).json({ error: "ID tidak valid" });
  }

  if (req.method === "PATCH") {
    const { fullName, phone } = req.body ?? {};

    if (typeof fullName !== "string" || fullName.trim() === "") {
      return res.status(400).json({ error: "Nama wali kelas wajib diisi" });
    }

    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      return res.status(400).json({ error: "Nomor telepon tidak valid" });
    }

    try {
      const teacher = await prisma.teacher.update({
        where: { id },
        data: {
          fullName: fullName.trim(),
          phone: typeof phone === "string" && phone.trim() !== "" ? phone.trim() : null,
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
          createdAt: true,
          classes: { select: { id: true, name: true } },
        },
      });
      return res.status(200).json(teacher);
    } catch (error) {
      const maybeError = error as { code?: string };
      if (maybeError?.code === "P2025") {
        return res.status(404).json({ error: "Wali kelas tidak ditemukan" });
      }
      return res.status(500).json({ error: "Gagal memperbarui wali kelas" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const teacher = await prisma.teacher.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });
      if (!teacher) {
        return res.status(404).json({ error: "Wali kelas tidak ditemukan" });
      }

      await prisma.$transaction(async (tx) => {
        await tx.class.updateMany({
          where: { homeroomTeacherId: id },
          data: { homeroomTeacherId: null },
        });

        await tx.teacher.delete({ where: { id } });

        if (teacher.userId) {
          await tx.user.delete({ where: { id: teacher.userId } });
        }
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "Gagal menghapus wali kelas" });
    }
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
