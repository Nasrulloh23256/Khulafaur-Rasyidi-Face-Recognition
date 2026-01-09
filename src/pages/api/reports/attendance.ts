import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const parseDate = (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const buildMonthRange = (start: Date, end: Date) => {
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const months: { key: string; label: string }[] = [];
  while (cursor <= end) {
    const key = getMonthKey(cursor);
    months.push({ key, label: monthLabels[cursor.getMonth()] });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
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
    return res.status(400).json({ error: "Tanggal laporan tidak valid" });
  }

  const start = startOfDay(startDate);
  const end = endOfDay(endDate);
  const classId = typeof req.query.classId === "string" ? req.query.classId : "";

  const [attendances, totalStudents] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(classId ? { classId } : {}),
      },
      select: {
        date: true,
        status: true,
        studentId: true,
        student: {
          select: {
            fullName: true,
            studentNumber: true,
            class: { select: { name: true } },
          },
        },
      },
    }),
    prisma.student.count({
      where: classId ? { classId } : undefined,
    }),
  ]);

  const monthStats = new Map<
    string,
    { present: number; sick: number; permit: number; absent: number; total: number }
  >();
  const studentStats = new Map<
    string,
    { id: string; name: string; className: string; present: number; sick: number; permit: number; absent: number; total: number }
  >();

  let totalRecords = 0;
  let totalPresent = 0;

  for (const item of attendances) {
    totalRecords += 1;
    if (item.status === "PRESENT") totalPresent += 1;

    const monthKey = getMonthKey(item.date);
    const currentMonth = monthStats.get(monthKey) ?? { present: 0, sick: 0, permit: 0, absent: 0, total: 0 };
    currentMonth.total += 1;
    if (item.status === "PRESENT") currentMonth.present += 1;
    if (item.status === "SICK") currentMonth.sick += 1;
    if (item.status === "PERMIT") currentMonth.permit += 1;
    if (item.status === "ABSENT") currentMonth.absent += 1;
    monthStats.set(monthKey, currentMonth);

    const studentKey = item.studentId;
    const currentStudent =
      studentStats.get(studentKey) ?? {
        id: item.studentId,
        name: item.student.fullName,
        className: item.student.class?.name ?? "-",
        present: 0,
        sick: 0,
        permit: 0,
        absent: 0,
        total: 0,
      };
    currentStudent.total += 1;
    if (item.status === "PRESENT") currentStudent.present += 1;
    if (item.status === "SICK") currentStudent.sick += 1;
    if (item.status === "PERMIT") currentStudent.permit += 1;
    if (item.status === "ABSENT") currentStudent.absent += 1;
    studentStats.set(studentKey, currentStudent);
  }

  const monthRange = buildMonthRange(start, end);
  const chart = monthRange.map((month) => {
    const stats = monthStats.get(month.key) ?? { present: 0, sick: 0, permit: 0, absent: 0, total: 0 };
    const total = stats.total || 1;
    return {
      bulan: month.label,
      hadir: (stats.present / total) * 100,
      sakit: (stats.sick / total) * 100,
      izin: (stats.permit / total) * 100,
    };
  });

  const ranking = Array.from(studentStats.values())
    .map((student) => {
      const percent = student.total ? (student.present / student.total) * 100 : 0;
      return {
        id: student.id,
        nama: student.name,
        kelas: student.className,
        hadir: student.present,
        sakit: student.sick,
        izin: student.permit,
        persentase: percent,
      };
    })
    .sort((a, b) => {
      if (b.persentase !== a.persentase) return b.persentase - a.persentase;
      if (b.hadir !== a.hadir) return b.hadir - a.hadir;
      return a.nama.localeCompare(b.nama);
    })
    .slice(0, 5);

  const perfectAttendance = Array.from(studentStats.values()).filter(
    (student) => student.total > 0 && student.present === student.total,
  ).length;

  const summary = {
    averageAttendance: totalRecords ? (totalPresent / totalRecords) * 100 : 0,
    totalStudents,
    perfectAttendance,
  };

  return res.status(200).json({ summary, chart, ranking });
}
