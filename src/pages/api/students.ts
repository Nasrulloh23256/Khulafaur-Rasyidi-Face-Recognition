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

const isGender = (value: unknown): value is "MALE" | "FEMALE" => value === "MALE" || value === "FEMALE";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const unassigned = req.query.unassigned === "true";

    const students = await prisma.student.findMany({
      where: unassigned ? { classId: null } : undefined,
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        studentNumber: true,
        gender: true,
        guardianName: true,
        classId: true,
        faceImageUrl: true,
        faceEmbedding: true,
        class: { select: { id: true, name: true } },
      },
    });

    const payload = students.map((student) => ({
      ...student,
      hasFace: !!student.faceEmbedding,
      faceEmbedding: undefined,
    }));

    return res.status(200).json(payload);
  }

  if (req.method === "POST") {
    const { fullName, studentNumber, gender, guardianName, classId, faceImage, faceDescriptor } = req.body ?? {};

    if (typeof fullName !== "string" || fullName.trim() === "") {
      return res.status(400).json({ error: "Nama siswa wajib diisi" });
    }

    if (!isGender(gender)) {
      return res.status(400).json({ error: "Jenis kelamin wajib dipilih" });
    }

    if (studentNumber !== undefined && studentNumber !== null && typeof studentNumber !== "string") {
      return res.status(400).json({ error: "NIS tidak valid" });
    }

    if (guardianName !== undefined && guardianName !== null && typeof guardianName !== "string") {
      return res.status(400).json({ error: "Nama orang tua tidak valid" });
    }

    if (typeof classId !== "string" || classId.trim() === "") {
      return res.status(400).json({ error: "Kelas wajib dipilih" });
    }

    const existingClass = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true },
    });
    if (!existingClass) {
      return res.status(404).json({ error: "Kelas tidak ditemukan" });
    }

    let faceImageUrl: string | null = null;
    if (faceImage !== undefined && faceImage !== null) {
      if (typeof faceImage !== "string" || faceImage.trim() === "") {
        return res.status(400).json({ error: "Format foto wajah tidak valid" });
      }
      try {
        faceImageUrl = await saveBase64Image(faceImage);
      } catch (error) {
        const message = error instanceof Error ? error.message : "INVALID_IMAGE";
        if (message === "IMAGE_TOO_LARGE") {
          return res.status(413).json({ error: "Ukuran foto maksimal 2MB" });
        }
        return res.status(400).json({ error: "Format foto wajah tidak valid" });
      }
    }

    let faceEmbedding: number[] | null = null;
    if (faceDescriptor !== undefined && faceDescriptor !== null) {
      if (!Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
        return res.status(400).json({ error: "Data wajah tidak valid" });
      }
      const numericDescriptor = faceDescriptor.filter((value: unknown) => typeof value === "number");
      if (numericDescriptor.length !== faceDescriptor.length) {
        return res.status(400).json({ error: "Data wajah tidak valid" });
      }
      faceEmbedding = numericDescriptor;
    } else if (faceImageUrl) {
      return res.status(400).json({ error: "Wajah tidak terdeteksi. Gunakan foto lain." });
    }

    const cleanStudentNumber =
      typeof studentNumber === "string" && studentNumber.trim() !== "" ? studentNumber.trim() : null;
    const cleanGuardianName =
      typeof guardianName === "string" && guardianName.trim() !== "" ? guardianName.trim() : null;

    try {
      const student = await prisma.student.create({
        data: {
          fullName: fullName.trim(),
          studentNumber: cleanStudentNumber,
          gender,
          guardianName: cleanGuardianName,
          classId,
          faceImageUrl,
          faceEmbedding,
        },
        select: {
          id: true,
          fullName: true,
          studentNumber: true,
          gender: true,
          guardianName: true,
          classId: true,
          faceImageUrl: true,
          class: { select: { id: true, name: true } },
        },
      });

      return res.status(201).json(student);
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
      console.error("CREATE_STUDENT_FAILED", error);
      const detail = error instanceof Error ? error.message : "Unknown error";
      return res
        .status(500)
        .json({ error: "Gagal menyimpan siswa", detail: process.env.NODE_ENV === "development" ? detail : undefined });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
