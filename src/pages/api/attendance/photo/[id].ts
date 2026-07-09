import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const parseDataUrl = (value: string) => {
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1] === "image/jpg" ? "image/jpeg" : match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    return res.status(400).json({ error: "ID absensi tidak valid" });
  }

  const attendance = await prisma.attendance.findUnique({
    where: { id },
    select: { checkInPhotoUrl: true },
  });
  const photoUrl = attendance?.checkInPhotoUrl;
  if (!photoUrl) {
    return res.status(404).json({ error: "Foto absensi tidak ditemukan" });
  }

  if (/^https?:\/\//.test(photoUrl) || photoUrl.startsWith("/")) {
    res.setHeader("Cache-Control", "private, max-age=300");
    res.redirect(302, photoUrl);
    return;
  }

  const parsed = parseDataUrl(photoUrl);
  if (!parsed) {
    return res.status(404).json({ error: "Foto absensi tidak valid" });
  }

  res.setHeader("Content-Type", parsed.contentType);
  res.setHeader("Cache-Control", "private, max-age=300");
  return res.status(200).send(parsed.buffer);
}
