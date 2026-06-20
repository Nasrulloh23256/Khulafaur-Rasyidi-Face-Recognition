import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatTime = (value: Date | null) => {
  if (!value) return null;
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const dateParam = typeof req.query.date === "string" ? req.query.date : "";
  const baseDate = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    return res.status(400).json({ error: "Tanggal tidak valid" });
  }

  const date = startOfDay(baseDate);

  const teachers = await prisma.teacher.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      phone: true,
      faceImageUrl: true,
      faceEmbedding: true,
      attendances: {
        where: { date },
        select: { status: true, checkInTime: true, checkOutTime: true, notes: true },
      },
    },
  });

  const data = teachers.map((teacher) => {
    const attendance = teacher.attendances[0];
    return {
      id: teacher.id,
      fullName: teacher.fullName,
      phone: teacher.phone,
      faceImageUrl: teacher.faceImageUrl,
      hasFace: !!teacher.faceEmbedding,
      status: attendance?.status ?? null,
      checkInTime: formatTime(attendance?.checkInTime ?? null),
      checkOutTime: formatTime(attendance?.checkOutTime ?? null),
      notes: attendance?.notes ?? null,
    };
  });

  return res.status(200).json({ date: date.toISOString(), teachers: data });
}
