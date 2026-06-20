import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import {
  ensureTeacherAttendanceTable,
  parseDateKey,
  serializeTeacherAttendance,
} from "@/lib/teacher-attendance";

type AttendanceAction = "check-in" | "check-out";

const getStatus = (attendance: { checkInTime: Date | null; checkOutTime: Date | null } | null | undefined) => {
  if (!attendance?.checkInTime) return "BELUM_ABSEN";
  if (!attendance.checkOutTime) return "SUDAH_DATANG";
  return "SELESAI";
};

const findTeacherByUserId = async (userId: string) =>
  prisma.teacher.findUnique({
    where: { userId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      user: { select: { email: true } },
      classes: { select: { id: true, name: true } },
    },
  });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureTeacherAttendanceTable();

  if (req.method === "GET") {
    const date = parseDateKey(req.query.date);
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";

    if (userId) {
      const teacher = await findTeacherByUserId(userId);
      if (!teacher) {
        return res.status(404).json({ error: "Akun guru belum terhubung dengan data pengajar" });
      }

      const [today, recent] = await Promise.all([
        prisma.teacherAttendance.findUnique({
          where: { teacherId_date: { teacherId: teacher.id, date } },
          select: { id: true, date: true, checkInTime: true, checkOutTime: true, notes: true },
        }),
        prisma.teacherAttendance.findMany({
          where: { teacherId: teacher.id },
          orderBy: { date: "desc" },
          take: 7,
          select: { id: true, date: true, checkInTime: true, checkOutTime: true, notes: true },
        }),
      ]);

      return res.status(200).json({
        date: date.toISOString(),
        teacher,
        today: serializeTeacherAttendance(today),
        status: getStatus(today),
        recent: recent.map(serializeTeacherAttendance),
      });
    }

    const teachers = await prisma.teacher.findMany({
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        phone: true,
        user: { select: { email: true } },
        classes: { select: { id: true, name: true } },
        teacherAttendances: {
          where: { date },
          take: 1,
          select: { id: true, date: true, checkInTime: true, checkOutTime: true, notes: true },
        },
      },
    });

    const rows = teachers.map((teacher) => {
      const attendance = teacher.teacherAttendances[0] ?? null;
      return {
        id: teacher.id,
        fullName: teacher.fullName,
        phone: teacher.phone,
        email: teacher.user?.email ?? null,
        classes: teacher.classes,
        attendance: serializeTeacherAttendance(attendance),
        status: getStatus(attendance),
      };
    });

    const checkedIn = rows.filter((row) => row.status !== "BELUM_ABSEN").length;
    const checkedOut = rows.filter((row) => row.status === "SELESAI").length;

    return res.status(200).json({
      date: date.toISOString(),
      stats: {
        totalTeachers: rows.length,
        checkedIn,
        checkedOut,
        notCheckedIn: rows.length - checkedIn,
      },
      teachers: rows,
    });
  }

  if (req.method === "POST") {
    const { userId, action, date: dateValue } = req.body ?? {};
    const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
    const resolvedAction = typeof action === "string" ? action : "";

    if (!normalizedUserId) {
      return res.status(400).json({ error: "Akun guru tidak valid" });
    }

    if (resolvedAction !== "check-in" && resolvedAction !== "check-out") {
      return res.status(400).json({ error: "Aksi absensi tidak valid" });
    }

    const teacher = await findTeacherByUserId(normalizedUserId);
    if (!teacher) {
      return res.status(404).json({ error: "Akun guru belum terhubung dengan data pengajar" });
    }

    const date = parseDateKey(dateValue);
    const now = new Date();
    const attendanceAction = resolvedAction as AttendanceAction;

    if (attendanceAction === "check-in") {
      const existing = await prisma.teacherAttendance.findUnique({
        where: { teacherId_date: { teacherId: teacher.id, date } },
        select: { id: true, date: true, checkInTime: true, checkOutTime: true, notes: true },
      });

      if (existing?.checkInTime) {
        return res.status(409).json({
          error: "Pengajar sudah absen datang hari ini",
          attendance: serializeTeacherAttendance(existing),
          status: getStatus(existing),
        });
      }

      const attendance = await prisma.teacherAttendance.upsert({
        where: { teacherId_date: { teacherId: teacher.id, date } },
        create: { teacherId: teacher.id, date, checkInTime: now },
        update: { checkInTime: now },
        select: { id: true, date: true, checkInTime: true, checkOutTime: true, notes: true },
      });

      return res.status(200).json({
        teacher,
        attendance: serializeTeacherAttendance(attendance),
        status: getStatus(attendance),
      });
    }

    const existing = await prisma.teacherAttendance.findUnique({
      where: { teacherId_date: { teacherId: teacher.id, date } },
      select: { id: true, date: true, checkInTime: true, checkOutTime: true, notes: true },
    });

    if (!existing?.checkInTime) {
      return res.status(400).json({ error: "Absensi datang belum dicatat" });
    }

    if (existing.checkOutTime) {
      return res.status(409).json({
        error: "Pengajar sudah absen pulang hari ini",
        attendance: serializeTeacherAttendance(existing),
        status: getStatus(existing),
      });
    }

    const attendance = await prisma.teacherAttendance.update({
      where: { id: existing.id },
      data: { checkOutTime: now },
      select: { id: true, date: true, checkInTime: true, checkOutTime: true, notes: true },
    });

    return res.status(200).json({
      teacher,
      attendance: serializeTeacherAttendance(attendance),
      status: getStatus(attendance),
    });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
