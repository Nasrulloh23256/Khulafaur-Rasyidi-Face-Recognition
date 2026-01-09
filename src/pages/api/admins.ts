import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return res.status(200).json(admins);
  }

  if (req.method === "POST") {
    const { name, email, password } = req.body ?? {};

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Nama wajib diisi" });
    }

    if (typeof email !== "string" || email.trim() === "") {
      return res.status(400).json({ error: "Email wajib diisi" });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password minimal 8 karakter" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      return res.status(409).json({ error: "Email sudah terdaftar" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: "ADMIN",
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return res.status(201).json(admin);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
