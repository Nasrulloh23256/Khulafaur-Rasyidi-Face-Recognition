import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import {
  ensureStudentAttendanceColumns,
  serializeStudentAttendanceAreaStatus,
  formatStudentAttendanceTime,
  serializeStudentAttendanceLocation,
} from "@/lib/student-attendance";
import { getClassAttendanceScheduleStatus } from "@/lib/class-schedule";
import { ensureClassScheduleTable } from "@/lib/class-schedule-storage";

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureStudentAttendanceColumns();
  await ensureClassScheduleTable();

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const classId = typeof req.query.classId === "string" ? req.query.classId : "";
  if (!classId) {
    return res.status(400).json({ error: "Kelas wajib dipilih" });
  }

  const dateParam = typeof req.query.date === "string" ? req.query.date : "";
  const baseDate = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    return res.status(400).json({ error: "Tanggal tidak valid" });
  }

  const date = startOfDay(baseDate);

  const [kelas, students] = await Promise.all([
    prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        schedules: { select: { dayOfWeek: true, startTime: true, endTime: true }, orderBy: { dayOfWeek: "asc" } },
      },
    }),
    prisma.student.findMany({
      where: { classId },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        studentNumber: true,
        gender: true,
        faceImageUrl: true,
        attendances: {
          where: { date },
          select: {
            id: true,
            status: true,
            checkInTime: true,
            checkInLatitude: true,
            checkInLongitude: true,
            checkInAccuracy: true,
            checkInPhotoUrl: true,
          },
        },
      },
    }),
  ]);

  if (!kelas) {
    return res.status(404).json({ error: "Kelas tidak ditemukan" });
  }

  const data = students.map((student) => {
    const attendance = student.attendances[0];
    return {
      id: student.id,
      fullName: student.fullName,
      studentNumber: student.studentNumber,
      gender: student.gender,
      faceImageUrl: student.faceImageUrl,
      attendanceId: attendance?.id ?? null,
      status: attendance?.status ?? null,
      checkInTime: formatStudentAttendanceTime(attendance?.checkInTime ?? null),
      checkInPhotoUrl: attendance?.checkInPhotoUrl ?? null,
      checkInLocation: serializeStudentAttendanceLocation(attendance),
      checkInAreaStatus: serializeStudentAttendanceAreaStatus(attendance),
    };
  });

  return res.status(200).json({
    class: kelas,
    date: date.toISOString(),
    scheduleStatus: getClassAttendanceScheduleStatus(kelas.schedules),
    students: data,
  });
}
