import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const euclideanDistance = (a: number[], b: number[]) => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { studentId, classId, descriptor } = req.body ?? {};
  if (typeof studentId !== "string" || studentId.trim() === "") {
    return res.status(400).json({ error: "Siswa wajib dipilih" });
  }
  if (typeof classId !== "string" || classId.trim() === "") {
    return res.status(400).json({ error: "Kelas wajib dipilih" });
  }
  if (!Array.isArray(descriptor) || descriptor.length === 0) {
    return res.status(400).json({ error: "Data wajah tidak valid" });
  }
  const inputDescriptor = descriptor.filter((value: unknown) => typeof value === "number");
  if (inputDescriptor.length !== descriptor.length) {
    return res.status(400).json({ error: "Data wajah tidak valid" });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      classId: true,
      fullName: true,
      studentNumber: true,
      gender: true,
      faceEmbedding: true,
      class: { select: { name: true } },
    },
  });

  if (!student) {
    return res.status(404).json({ error: "Siswa tidak ditemukan" });
  }

  if (student.classId !== classId) {
    return res.status(400).json({ error: "Siswa tidak terdaftar di kelas ini" });
  }

  const date = startOfDay(new Date());
  const existingAttendance = await prisma.attendance.findUnique({
    where: { studentId_date: { studentId, date } },
    select: { id: true },
  });
  if (existingAttendance) {
    return res.status(409).json({ error: "Siswa sudah absen hari ini" });
  }

  const embeddings: number[][] = [];
  if (Array.isArray(student.faceEmbedding)) {
    embeddings.push(student.faceEmbedding as number[]);
  } else if (student.faceEmbedding && typeof student.faceEmbedding === "object") {
    const embeddingObj = student.faceEmbedding as { mean?: unknown; samples?: unknown };
    const samples = Array.isArray(embeddingObj.samples) ? embeddingObj.samples : [];
    const mean = Array.isArray(embeddingObj.mean) ? embeddingObj.mean : null;
    for (const sample of samples) {
      if (Array.isArray(sample)) {
        const numeric = sample.filter((value) => typeof value === "number");
        if (numeric.length === sample.length) {
          embeddings.push(numeric as number[]);
        }
      }
    }
    if (embeddings.length === 0 && mean) {
      const numeric = mean.filter((value) => typeof value === "number");
      if (numeric.length === mean.length) {
        embeddings.push(numeric as number[]);
      }
    }
  }

  if (embeddings.length === 0) {
    return res.status(404).json({ error: "Wajah siswa belum terdaftar" });
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  for (const embedding of embeddings) {
    if (embedding.length !== inputDescriptor.length) continue;
    const distance = euclideanDistance(inputDescriptor, embedding);
    if (distance < bestDistance) {
      bestDistance = distance;
    }
  }

  const threshold = 0.55;
  if (bestDistance > threshold) {
    return res.status(200).json({ match: null, distance: bestDistance });
  }

  return res.status(200).json({
    match: {
      id: student.id,
      fullName: student.fullName,
      studentNumber: student.studentNumber,
      gender: student.gender,
      className: student.class?.name ?? "-",
    },
    distance: bestDistance,
  });
}
