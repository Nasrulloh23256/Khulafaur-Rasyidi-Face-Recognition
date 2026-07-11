import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { getOperationalClassPeriod } from "@/lib/class-period";
import { parseClassSchedules } from "@/lib/class-schedule";
import { ensureClassScheduleTable } from "@/lib/class-schedule-storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureClassScheduleTable();

  if (req.method === "GET") {
    const classes = await prisma.class.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        homeroomTeacher: { select: { id: true, fullName: true } },
        schedules: { select: { dayOfWeek: true, startTime: true, endTime: true }, orderBy: { dayOfWeek: "asc" } },
        _count: { select: { students: true } },
      },
    });

    return res.status(200).json(classes);
  }

  if (req.method === "POST") {
    const { name, homeroomTeacherId, schedules } = req.body ?? {};

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Nama kelas wajib diisi" });
    }

    const parsedSchedules = parseClassSchedules(schedules);
    if (!parsedSchedules.schedules) {
      return res.status(400).json({ error: parsedSchedules.error });
    }

    let resolvedTeacherId: string | null = null;
    if (typeof homeroomTeacherId === "string" && homeroomTeacherId.trim() !== "") {
      resolvedTeacherId = homeroomTeacherId;
      const teacherExists = await prisma.teacher.findUnique({
        where: { id: resolvedTeacherId },
        select: { id: true },
      });
      if (!teacherExists) {
        return res.status(404).json({ error: "Wali kelas tidak ditemukan" });
      }
    }

    try {
      const period = await getOperationalClassPeriod();
      const createdClass = await prisma.$transaction((tx) =>
        tx.class.create({
          data: {
            name: name.trim(),
            academicYearId: period.academicYearId,
            semesterId: period.semesterId,
            homeroomTeacherId: resolvedTeacherId,
            schedules: { create: parsedSchedules.schedules },
          },
          select: {
            id: true,
            name: true,
            homeroomTeacher: { select: { id: true, fullName: true } },
            schedules: { select: { dayOfWeek: true, startTime: true, endTime: true }, orderBy: { dayOfWeek: "asc" } },
            _count: { select: { students: true } },
          },
        }),
      );

      return res.status(201).json(createdClass);
    } catch (error) {
      const maybeError = error as { code?: string };
      if (maybeError?.code === "P2002") {
        return res.status(409).json({ error: "Nama kelas sudah terdaftar" });
      }
      return res.status(500).json({ error: "Gagal menyimpan kelas" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
