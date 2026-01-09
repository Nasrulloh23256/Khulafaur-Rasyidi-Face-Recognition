import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const allowedStatus = ["PRESENT", "ABSENT", "SICK", "PERMIT"] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { studentId, classId, status } = req.body ?? {};

  if (typeof studentId !== "string" || studentId.trim() === "") {
    return res.status(400).json({ error: "Siswa tidak valid" });
  }

  if (typeof classId !== "string" || classId.trim() === "") {
    return res.status(400).json({ error: "Kelas wajib dipilih" });
  }

  const resolvedStatus =
    typeof status === "string" && allowedStatus.includes(status as typeof allowedStatus[number])
      ? (status as typeof allowedStatus[number])
      : "PRESENT";

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classId: true },
  });

  if (!student) {
    return res.status(404).json({ error: "Siswa tidak ditemukan" });
  }

  if (student.classId !== classId) {
    return res.status(400).json({ error: "Siswa tidak berada di kelas ini" });
  }

  const kelas = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
  if (!kelas) {
    return res.status(404).json({ error: "Kelas tidak ditemukan" });
  }

  const date = startOfDay(new Date());

  const existing = await prisma.attendance.findUnique({
    where: { studentId_date: { studentId, date } },
    select: { id: true },
  });

  if (existing) {
    return res.status(409).json({ error: "Siswa sudah absen hari ini" });
  }

  let attendance;
  try {
    attendance = await prisma.attendance.create({
      data: {
        studentId,
        classId,
        status: resolvedStatus,
        date,
        checkInTime: new Date(),
      },
    });
  } catch (error) {
    const maybeError = error as { code?: string };
    if (maybeError?.code === "P2002") {
      return res.status(409).json({ error: "Siswa sudah absen hari ini" });
    }
    return res.status(500).json({ error: "Gagal menyimpan absensi" });
  }

  return res.status(200).json(attendance);
}
