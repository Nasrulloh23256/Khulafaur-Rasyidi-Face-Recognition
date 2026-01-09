import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const teachers = await prisma.teacher.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        fullName: true,
        phone: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        classes: { select: { id: true, name: true } },
      },
    });
    return res.status(200).json(teachers);
  }

  if (req.method === "POST") {
    const { fullName, phone } = req.body ?? {};

    if (typeof fullName !== "string" || fullName.trim() === "") {
      return res.status(400).json({ error: "Nama wali kelas wajib diisi" });
    }

    if (phone && typeof phone !== "string") {
      return res.status(400).json({ error: "Nomor telepon tidak valid" });
    }

    const teacher = await prisma.teacher.create({
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

    return res.status(201).json(teacher);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
