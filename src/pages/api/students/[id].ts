import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const saveBase64Image = async (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) {
    throw new Error("INVALID_FORMAT");
  }
  const ext = match[2] === "jpeg" ? "jpg" : match[2];
  const buffer = Buffer.from(match[3], "base64");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${filename}`;
};

const isGender = (value: unknown): value is "MALE" | "FEMALE" => value === "MALE" || value === "FEMALE";

const parseGuardianPhone = (value: unknown) => {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 16 ? value.trim() : undefined;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    return res.status(400).json({ error: "ID siswa tidak valid" });
  }

  const existing = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return res.status(404).json({ error: "Siswa tidak ditemukan" });
  }

  if (req.method === "PATCH") {
    const { fullName, studentNumber, gender, guardianName, guardianPhone, classId, faceImage, faceDescriptor } = req.body ?? {};
    const updateData: {
      fullName?: string;
      studentNumber?: string | null;
      gender?: "MALE" | "FEMALE";
      guardianName?: string | null;
      guardianPhone?: string | null;
      classId?: string | null;
      faceImageUrl?: string | null;
      faceEmbedding?: number[] | null;
    } = {};

    if (fullName !== undefined) {
      if (typeof fullName !== "string" || fullName.trim() === "") {
        return res.status(400).json({ error: "Nama siswa wajib diisi" });
      }
      updateData.fullName = fullName.trim();
    }

    if (studentNumber !== undefined) {
      if (studentNumber === null) {
        updateData.studentNumber = null;
      } else if (typeof studentNumber === "string") {
        updateData.studentNumber = studentNumber.trim() !== "" ? studentNumber.trim() : null;
      } else {
        return res.status(400).json({ error: "NIS tidak valid" });
      }
    }

    if (gender !== undefined) {
      if (!isGender(gender)) {
        return res.status(400).json({ error: "Jenis kelamin tidak valid" });
      }
      updateData.gender = gender;
    }

    if (guardianName !== undefined) {
      if (guardianName === null) {
        updateData.guardianName = null;
      } else if (typeof guardianName === "string") {
        updateData.guardianName = guardianName.trim() !== "" ? guardianName.trim() : null;
      } else {
        return res.status(400).json({ error: "Nama orang tua tidak valid" });
      }
    }

    if (guardianPhone !== undefined) {
      const resolvedGuardianPhone = parseGuardianPhone(guardianPhone);
      if (resolvedGuardianPhone === undefined) {
        return res.status(400).json({ error: "Nomor WhatsApp orang tua tidak valid" });
      }
      updateData.guardianPhone = resolvedGuardianPhone;
    }

    if (classId !== undefined) {
      if (classId === null || classId === "") {
        return res.status(400).json({ error: "Kelas wajib dipilih" });
      } else if (typeof classId === "string") {
        const existingClass = await prisma.class.findUnique({
          where: { id: classId },
          select: { id: true },
        });
        if (!existingClass) {
          return res.status(404).json({ error: "Kelas tidak ditemukan" });
        }
        updateData.classId = classId;
      } else {
        return res.status(400).json({ error: "Kelas tidak valid" });
      }
    }

    if (faceImage !== undefined && faceImage !== null) {
      if (typeof faceImage !== "string" || faceImage.trim() === "") {
        return res.status(400).json({ error: "Format foto wajah tidak valid" });
      }
      try {
        updateData.faceImageUrl = await saveBase64Image(faceImage);
      } catch (error) {
        const message = error instanceof Error ? error.message : "INVALID_IMAGE";
        if (message === "IMAGE_TOO_LARGE") {
          return res.status(413).json({ error: "Ukuran foto maksimal 2MB" });
        }
        return res.status(400).json({ error: "Format foto wajah tidak valid" });
      }
    }

    if (faceDescriptor !== undefined && faceDescriptor !== null) {
      if (!Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
        return res.status(400).json({ error: "Data wajah tidak valid" });
      }
      const numericDescriptor = faceDescriptor.filter((value: unknown) => typeof value === "number");
      if (numericDescriptor.length !== faceDescriptor.length) {
        return res.status(400).json({ error: "Data wajah tidak valid" });
      }
      updateData.faceEmbedding = numericDescriptor;
    } else if (updateData.faceImageUrl) {
      return res.status(400).json({ error: "Wajah tidak terdeteksi. Gunakan foto lain." });
    }

    try {
      const student = await prisma.student.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          fullName: true,
          studentNumber: true,
          gender: true,
          guardianName: true,
          guardianPhone: true,
          classId: true,
          faceImageUrl: true,
          faceEmbedding: true,
          class: { select: { id: true, name: true } },
        },
      });
      return res.status(200).json(student);
    } catch (error) {
      const maybeError = error as { code?: string };
      if (maybeError?.code === "P2002") {
        return res.status(409).json({ error: "NIS sudah digunakan" });
      }
      if (maybeError?.code === "P2003") {
        return res.status(400).json({ error: "Kelas tidak valid" });
      }
      if (maybeError?.code === "P2011") {
        return res.status(400).json({ error: "Kelas wajib dipilih" });
      }
      console.error("UPDATE_STUDENT_FAILED", error);
      const detail = error instanceof Error ? error.message : "Unknown error";
      return res
        .status(500)
        .json({ error: "Gagal memperbarui siswa", detail: process.env.NODE_ENV === "development" ? detail : undefined });
    }
  }

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.attendance.deleteMany({ where: { studentId: id } });
    await tx.student.delete({ where: { id } });
  });

  return res.status(204).end();
}
