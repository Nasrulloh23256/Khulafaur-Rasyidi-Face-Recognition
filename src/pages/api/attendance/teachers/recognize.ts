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

const extractEmbeddings = (faceEmbedding: unknown) => {
  const embeddings: number[][] = [];
  if (Array.isArray(faceEmbedding)) {
    embeddings.push(faceEmbedding as number[]);
    return embeddings;
  }
  if (faceEmbedding && typeof faceEmbedding === "object") {
    const embeddingObj = faceEmbedding as { mean?: unknown; samples?: unknown };
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
  return embeddings;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { teacherId, descriptor } = req.body ?? {};
  const normalizedTeacherId = typeof teacherId === "string" ? teacherId.trim() : "";

  if (!Array.isArray(descriptor) || descriptor.length === 0) {
    return res.status(400).json({ error: "Data wajah tidak valid" });
  }
  const inputDescriptor = descriptor.filter((value: unknown) => typeof value === "number");
  if (inputDescriptor.length !== descriptor.length) {
    return res.status(400).json({ error: "Data wajah tidak valid" });
  }

  const buildMatch = (teacher: {
    id: string;
    fullName: string;
    phone: string | null;
  }) => ({
    id: teacher.id,
    fullName: teacher.fullName,
    phone: teacher.phone,
  });

  const threshold = 0.55;
  const date = startOfDay(new Date());

  if (normalizedTeacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: normalizedTeacherId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        faceEmbedding: true,
      },
    });

    if (!teacher) {
      return res.status(404).json({ error: "Pengajar tidak ditemukan" });
    }

    const embeddings = extractEmbeddings(teacher.faceEmbedding);
    if (embeddings.length === 0) {
      return res.status(404).json({ error: "Wajah pengajar belum terdaftar" });
    }

    let bestDistance = Number.POSITIVE_INFINITY;
    for (const embedding of embeddings) {
      if (embedding.length !== inputDescriptor.length) continue;
      const distance = euclideanDistance(inputDescriptor, embedding);
      if (distance < bestDistance) {
        bestDistance = distance;
      }
    }

    if (bestDistance > threshold) {
      return res.status(200).json({ match: null, distance: bestDistance });
    }

    const existingAttendance = await prisma.teacherAttendance.findUnique({
      where: { teacherId_date: { teacherId: teacher.id, date } },
    });

    if (existingAttendance && existingAttendance.checkInTime && existingAttendance.checkOutTime) {
      return res.status(409).json({ error: "Pengajar sudah absen masuk & keluar hari ini", match: buildMatch(teacher) });
    }

    return res.status(200).json({
      match: buildMatch(teacher),
      distance: bestDistance,
    });
  }

  const teachers = await prisma.teacher.findMany({
    where: { faceEmbedding: { not: null } },
    select: {
      id: true,
      fullName: true,
      phone: true,
      faceEmbedding: true,
    },
  });

  if (teachers.length === 0) {
    return res.status(404).json({ error: "Wajah pengajar belum terdaftar" });
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestTeacher: typeof teachers[number] | null = null;

  for (const teacher of teachers) {
    const embeddings = extractEmbeddings(teacher.faceEmbedding);
    if (embeddings.length === 0) continue;
    for (const embedding of embeddings) {
      if (embedding.length !== inputDescriptor.length) continue;
      const distance = euclideanDistance(inputDescriptor, embedding);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTeacher = teacher;
      }
    }
  }

  if (!bestTeacher || !Number.isFinite(bestDistance)) {
    return res.status(404).json({ error: "Wajah pengajar belum terdaftar" });
  }

  if (bestDistance > threshold) {
    return res.status(200).json({ match: null, distance: bestDistance });
  }

  const existingAttendance = await prisma.teacherAttendance.findUnique({
    where: { teacherId_date: { teacherId: bestTeacher.id, date } },
  });

  if (existingAttendance && existingAttendance.checkInTime && existingAttendance.checkOutTime) {
    return res.status(409).json({ error: "Pengajar sudah absen masuk & keluar hari ini", match: buildMatch(bestTeacher) });
  }

  // Update or Create the attendance record
  let type: "check-in" | "check-out" = "check-in";
  let attendance;

  if (existingAttendance) {
    type = "check-out";
    attendance = await prisma.teacherAttendance.update({
      where: { id: existingAttendance.id },
      data: {
        checkOutTime: new Date(),
      },
    });
  } else {
    attendance = await prisma.teacherAttendance.create({
      data: {
        teacherId: bestTeacher.id,
        status: "PRESENT",
        date,
        checkInTime: new Date(),
      },
    });
  }

  return res.status(200).json({
    match: buildMatch(bestTeacher),
    distance: bestDistance,
    type,
    attendance,
  });
}
