import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
  },
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_SAMPLES = 15;

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
  if (process.env.VERCEL) {
    return dataUrl;
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(uploadDir, filename), buffer);
    return `/uploads/${filename}`;
  } catch (error) {
    const maybeError = error as NodeJS.ErrnoException;
    if (maybeError?.code === "EROFS" || maybeError?.code === "EACCES") {
      return dataUrl;
    }
    throw error;
  }
};

const normalizeSamples = (input: unknown) => {
  if (!Array.isArray(input) || input.length === 0) return null;
  const samples = input.slice(0, MAX_SAMPLES);
  const first = samples[0];
  if (!Array.isArray(first) || first.length === 0) return null;
  const length = first.length;

  const normalized: number[][] = [];
  for (const sample of samples) {
    if (!Array.isArray(sample) || sample.length !== length) return null;
    const numeric = sample.filter((value) => typeof value === "number");
    if (numeric.length !== sample.length) return null;
    normalized.push(numeric as number[]);
  }
  return normalized;
};

const computeMeanEmbedding = (samples: number[][]) => {
  const length = samples[0].length;
  const mean = new Array<number>(length).fill(0);
  for (const sample of samples) {
    for (let i = 0; i < length; i += 1) {
      mean[i] += sample[i];
    }
  }
  for (let i = 0; i < length; i += 1) {
    mean[i] /= samples.length;
  }
  return mean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    return res.status(400).json({ error: "ID siswa tidak valid" });
  }

  const { descriptors, faceImage } = req.body ?? {};
  const samples = normalizeSamples(descriptors);
  if (!samples) {
    return res.status(400).json({ error: "Data wajah tidak valid" });
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

  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!student) {
    return res.status(404).json({ error: "Siswa tidak ditemukan" });
  }

  const mean = computeMeanEmbedding(samples);
  const faceEmbedding = {
    mean,
    samples,
  };

  const updated = await prisma.student.update({
    where: { id },
    data: {
      faceEmbedding,
      ...(faceImageUrl ? { faceImageUrl } : {}),
    },
    select: { id: true, faceImageUrl: true },
  });

  return res.status(200).json({
    id: updated.id,
    faceImageUrl: updated.faceImageUrl,
    sampleCount: samples.length,
  });
}
