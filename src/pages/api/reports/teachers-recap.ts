import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const pad = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const parseDate = (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTime = (value: Date | null) => {
  if (!value) return "";
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const startParam = req.query.start ?? req.query.startDate;
  const endParam = req.query.end ?? req.query.endDate;
  const startDate = parseDate(Array.isArray(startParam) ? startParam[0] : startParam);
  const endDate = parseDate(Array.isArray(endParam) ? endParam[0] : endParam);

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Tanggal tidak valid" });
  }

  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (start > end) {
    return res.status(400).json({ error: "Rentang tanggal tidak valid" });
  }

  const dates: { key: string; date: Date }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push({ key: toDateKey(cursor), date: new Date(cursor) });
    cursor.setDate(cursor.getDate() + 1);
  }

  const [teachers, attendances] = await Promise.all([
    prisma.teacher.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true },
    }),
    prisma.teacherAttendance.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      select: { teacherId: true, date: true, status: true, checkInTime: true, checkOutTime: true },
    }),
  ]);

  // Group attendance by teacher and date key
  const attendanceMap = new Map<string, Map<string, typeof attendances[number]>>();
  const datesWithAttendance = new Set<string>();

  for (const item of attendances) {
    const key = toDateKey(item.date);
    datesWithAttendance.add(key);
    if (!attendanceMap.has(item.teacherId)) {
      attendanceMap.set(item.teacherId, new Map());
    }
    attendanceMap.get(item.teacherId)?.set(key, item);
  }

  const today = startOfDay(new Date());

  const payload = teachers.map((teacher) => {
    const teacherAttendance = attendanceMap.get(teacher.id) ?? new Map<string, typeof attendances[number]>();
    const statuses: Record<string, { status: string; display: string; checkIn: string; checkOut: string }> = {};

    for (const item of dates) {
      const record = teacherAttendance.get(item.key);
      if (record) {
        let display = "";
        if (record.status === "PRESENT") {
          const inTime = formatTime(record.checkInTime);
          const outTime = formatTime(record.checkOutTime);
          display = `${inTime} - ${outTime || "--:--"}`;
        } else if (record.status === "SICK") {
          display = "Sakit";
        } else if (record.status === "PERMIT") {
          display = "Izin";
        } else if (record.status === "ABSENT") {
          display = "Alpha";
        }

        statuses[item.key] = {
          status: record.status,
          display,
          checkIn: formatTime(record.checkInTime),
          checkOut: formatTime(record.checkOutTime),
        };
      } else {
        // No attendance recorded on this day
        // If it's a date in the past where some teachers checked in, mark as Alpha (A), else "-"
        const status = datesWithAttendance.has(item.key) && item.date < today ? "ABSENT" : "UNMARKED";
        statuses[item.key] = {
          status,
          display: status === "ABSENT" ? "Alpha" : "-",
          checkIn: "",
          checkOut: "",
        };
      }
    }

    return {
      id: teacher.id,
      fullName: teacher.fullName,
      phone: teacher.phone ?? "-",
      statuses,
    };
  });

  return res.status(200).json({
    dates: dates.map((item) => item.key),
    teachers: payload,
  });
}
