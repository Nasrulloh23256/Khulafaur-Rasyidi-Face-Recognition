import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const pad = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const startOfWeek = (date: Date) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatTime = (value: Date | null) => {
  if (!value) return "-";
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

const statusLabel: Record<string, string> = {
  PRESENT: "Hadir",
  ABSENT: "Alpha",
  SICK: "Sakit",
  PERMIT: "Izin",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - 7);
  currentStart.setHours(0, 0, 0, 0);

  const previousStart = new Date(now);
  previousStart.setDate(previousStart.getDate() - 14);
  previousStart.setHours(0, 0, 0, 0);

  const [
    totalClasses,
    totalTeachers,
    totalStudents,
    totalAdmins,
    currentClasses,
    currentTeachers,
    currentStudents,
    currentAdmins,
    previousClasses,
    previousTeachers,
    previousStudents,
    previousAdmins,
  ] = await Promise.all([
    prisma.class.count(),
    prisma.teacher.count(),
    prisma.student.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.class.count({ where: { createdAt: { gte: currentStart } } }),
    prisma.teacher.count({ where: { createdAt: { gte: currentStart } } }),
    prisma.student.count({ where: { createdAt: { gte: currentStart } } }),
    prisma.user.count({ where: { role: "ADMIN", createdAt: { gte: currentStart } } }),
    prisma.class.count({ where: { createdAt: { gte: previousStart, lt: currentStart } } }),
    prisma.teacher.count({ where: { createdAt: { gte: previousStart, lt: currentStart } } }),
    prisma.student.count({ where: { createdAt: { gte: previousStart, lt: currentStart } } }),
    prisma.user.count({ where: { role: "ADMIN", createdAt: { gte: previousStart, lt: currentStart } } }),
  ]);

  const buildStat = (total: number, current: number, previous: number) => {
    const diff = current - previous;
    const change = diff === 0 ? "0" : diff > 0 ? `+${diff}` : `${diff}`;
    const trend = diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
    return { total, change, trend };
  };

  const stats = {
    classes: buildStat(totalClasses, currentClasses, previousClasses),
    teachers: buildStat(totalTeachers, currentTeachers, previousTeachers),
    students: buildStat(totalStudents, currentStudents, previousStudents),
    admins: buildStat(totalAdmins, currentAdmins, previousAdmins),
  };

  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 6);
  const attendances = await prisma.attendance.findMany({
    where: {
      date: {
        gte: weekStart,
        lt: weekEnd,
      },
    },
    select: { date: true, status: true },
  });

  const byDate = new Map<string, { present: number; total: number }>();
  for (const item of attendances) {
    const key = toDateKey(item.date);
    const current = byDate.get(key) ?? { present: 0, total: 0 };
    current.total += 1;
    if (item.status === "PRESENT") {
      current.present += 1;
    }
    byDate.set(key, current);
  }

  const dayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const weeklyAttendance = Array.from({ length: 6 }, (_, index) => {
    const date = addDays(weekStart, index);
    const key = toDateKey(date);
    const statsForDate = byDate.get(key) ?? { present: 0, total: 0 };
    return {
      label: dayLabels[date.getDay()],
      present: statsForDate.present,
      total: statsForDate.total,
    };
  });

  const recentRecords = await prisma.attendance.findMany({
    orderBy: { date: "desc" },
    take: 5,
    include: {
      student: { select: { fullName: true } },
      class: { select: { name: true } },
    },
  });

  const recentAttendance = recentRecords.map((item) => ({
    name: item.student.fullName,
    className: item.class?.name ?? "-",
    status: statusLabel[item.status] ?? item.status,
    time: formatTime(item.checkInTime),
  }));

  return res.status(200).json({ stats, weeklyAttendance, recentAttendance });
}
