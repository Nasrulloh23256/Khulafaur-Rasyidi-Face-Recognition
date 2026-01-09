import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

type ErrorResponse = { error: string };
type SuccessResponse = { id: string; name: string; email: string; role: string };

const isEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fullName, email, password, phone } = req.body ?? {};

  if (typeof fullName !== "string" || fullName.trim() === "") {
    return res.status(400).json({ error: "Nama wajib diisi" });
  }
  if (typeof email !== "string" || !isEmail(email)) {
    return res.status(400).json({ error: "Email tidak valid" });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password minimal 6 karakter" });
  }
  if (phone !== undefined && phone !== null && typeof phone !== "string") {
    return res.status(400).json({ error: "Nomor HP tidak valid" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: "Email sudah terdaftar" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: fullName.trim(),
          email: normalizedEmail,
          passwordHash,
          role: "TEACHER",
        },
      });

      const cleanName = fullName.trim();
      const cleanPhone = typeof phone === "string" && phone.trim() !== "" ? phone.trim() : null;

      const existingTeacher = await tx.teacher.findFirst({
        where: {
          userId: null,
          fullName: cleanName,
        },
        select: { id: true },
      });

      if (existingTeacher) {
        await tx.teacher.update({
          where: { id: existingTeacher.id },
          data: {
            userId: user.id,
            phone: cleanPhone,
          },
        });
      } else {
        await tx.teacher.create({
          data: {
            userId: user.id,
            fullName: cleanName,
            phone: cleanPhone,
          },
        });
      }

      return user;
    });

    return res.status(201).json({
      id: result.id,
      name: result.name,
      email: result.email,
      role: result.role,
    });
  } catch (error) {
    const maybeError = error as { code?: string };
    if (maybeError?.code === "P2002") {
      return res.status(409).json({ error: "Email sudah terdaftar" });
    }
    return res.status(500).json({ error: "Gagal membuat akun guru" });
  }
}
