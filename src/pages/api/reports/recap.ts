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

const statusMap: Record<string, string> = {
  PRESENT: "H",
  SICK: "S",
  PERMIT: "I",
  ABSENT: "A",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const classId = typeof req.query.classId === "string" ? req.query.classId : "";
  if (!classId) {
    return res.status(400).json({ error: "Kelas wajib dipilih" });
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

  const kelas = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true },
  });
  if (!kelas) {
    return res.status(404).json({ error: "Kelas tidak ditemukan" });
  }

  const dates: { key: string; date: Date }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push({ key: toDateKey(cursor), date: new Date(cursor) });
    cursor.setDate(cursor.getDate() + 1);
  }

  const [students, attendances] = await Promise.all([
    prisma.student.findMany({
      where: { classId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, studentNumber: true },
    }),
    prisma.attendance.findMany({
      where: {
        classId,
        date: {
          gte: start,
          lte: end,
        },
      },
      select: { studentId: true, date: true, status: true },
    }),
  ]);

  const attendanceByStudent = new Map<string, Map<string, string>>();
  const datesWithAttendance = new Set<string>();

  for (const item of attendances) {
    const key = toDateKey(item.date);
    datesWithAttendance.add(key);
    const status = statusMap[item.status] ?? "-";
    if (!attendanceByStudent.has(item.studentId)) {
      attendanceByStudent.set(item.studentId, new Map());
    }
    attendanceByStudent.get(item.studentId)?.set(key, status);
  }

  const today = startOfDay(new Date());

  const payload = students.map((student) => {
    const studentMap = attendanceByStudent.get(student.id) ?? new Map<string, string>();
    const statuses: Record<string, string> = {};
    for (const item of dates) {
      if (item.date > today) {
        statuses[item.key] = "-";
        continue;
      }
      const status = studentMap.get(item.key);
      if (status) {
        statuses[item.key] = status;
      } else if (datesWithAttendance.has(item.key)) {
        statuses[item.key] = "A";
      } else {
        statuses[item.key] = "-";
      }
    }
    return {
      id: student.id,
      fullName: student.fullName,
      studentNumber: student.studentNumber,
      statuses,
    };
  });

  return res.status(200).json({
    class: kelas,
    dates: dates.map((item) => item.key),
    students: payload,
  });
}
