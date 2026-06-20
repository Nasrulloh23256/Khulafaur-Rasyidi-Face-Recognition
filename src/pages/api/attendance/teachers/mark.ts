import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const allowedStatus = ["PRESENT", "ABSENT", "SICK", "PERMIT"] as const;

const parseTimeString = (baseDate: Date, timeStr: string | null) => {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { teacherId, status, checkInTimeStr, checkOutTimeStr } = req.body ?? {};

  if (typeof teacherId !== "string" || teacherId.trim() === "") {
    return res.status(400).json({ error: "Pengajar tidak valid" });
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { id: true },
  });

  if (!teacher) {
    return res.status(404).json({ error: "Pengajar tidak ditemukan" });
  }

  const date = startOfDay(new Date());

  if (status === "UNMARKED") {
    try {
      await prisma.teacherAttendance.deleteMany({
        where: { teacherId, date },
      });
      return res.status(200).json({ success: true, message: "Absensi dihapus" });
    } catch (error) {
      return res.status(500).json({ error: "Gagal menghapus absensi" });
    }
  }

  const resolvedStatus =
    typeof status === "string" && allowedStatus.includes(status as typeof allowedStatus[number])
      ? (status as typeof allowedStatus[number])
      : "PRESENT";

  const customCheckIn = checkInTimeStr ? parseTimeString(date, checkInTimeStr) : null;
  const customCheckOut = checkOutTimeStr ? parseTimeString(date, checkOutTimeStr) : null;

  try {
    const existing = await prisma.teacherAttendance.findUnique({
      where: { teacherId_date: { teacherId, date } },
    });

    let attendance;
    if (existing) {
      attendance = await prisma.teacherAttendance.update({
        where: { id: existing.id },
        data: {
          status: resolvedStatus,
          checkInTime: checkInTimeStr !== undefined ? customCheckIn : (resolvedStatus === "PRESENT" ? (existing.checkInTime ?? new Date()) : null),
          checkOutTime: checkOutTimeStr !== undefined ? customCheckOut : (resolvedStatus === "PRESENT" ? existing.checkOutTime : null),
        },
      });
    } else {
      attendance = await prisma.teacherAttendance.create({
        data: {
          teacherId,
          status: resolvedStatus,
          date,
          checkInTime: resolvedStatus === "PRESENT" ? (customCheckIn ?? new Date()) : null,
          checkOutTime: resolvedStatus === "PRESENT" ? customCheckOut : null,
        },
      });
    }

    return res.status(200).json(attendance);
  } catch (error) {
    console.error("MARK_TEACHER_FAILED", error);
    return res.status(500).json({ error: "Gagal menyimpan absensi pengajar" });
  }
}
