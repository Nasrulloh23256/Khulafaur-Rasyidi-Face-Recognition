import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import {
  ensureTeacherAttendanceTable,
  parseDateKey,
  serializeTeacherAttendance,
} from "@/lib/teacher-attendance";

type AttendanceAction = "check-in" | "check-out";
const FACE_MATCH_THRESHOLD = 0.55;

const getStatus = (attendance: { checkInTime: Date | null; checkOutTime: Date | null } | null | undefined) => {
  if (!attendance?.checkInTime) return "BELUM_ABSEN";
  if (!attendance.checkOutTime) return "SUDAH_DATANG";
  return "SELESAI";
};

const euclideanDistance = (a: number[], b: number[]) => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

const normalizeDescriptor = (descriptor: unknown) => {
  if (!Array.isArray(descriptor) || descriptor.length === 0) return null;
  const numeric = descriptor.filter((value) => typeof value === "number");
  if (numeric.length !== descriptor.length) return null;
  return numeric as number[];
};

const extractEmbeddings = (faceEmbedding: unknown) => {
  const embeddings: number[][] = [];
  if (Array.isArray(faceEmbedding)) {
    const numeric = faceEmbedding.filter((value) => typeof value === "number");
    if (numeric.length === faceEmbedding.length) embeddings.push(numeric as number[]);
    return embeddings;
  }
  if (faceEmbedding && typeof faceEmbedding === "object") {
    const embeddingObj = faceEmbedding as { mean?: unknown; samples?: unknown };
    const samples = Array.isArray(embeddingObj.samples) ? embeddingObj.samples : [];
    const mean = Array.isArray(embeddingObj.mean) ? embeddingObj.mean : null;
    for (const sample of samples) {
      if (!Array.isArray(sample)) continue;
      const numeric = sample.filter((value) => typeof value === "number");
      if (numeric.length === sample.length) {
        embeddings.push(numeric as number[]);
      }
    }
    if (embeddings.length === 0 && mean) {
      const numeric = mean.filter((value) => typeof value === "number");
      if (numeric.length === mean.length) {
        embeddings.push(numeric as number[]);
      }
    }
  }
  return embeddings;
};

const matchFace = (faceEmbedding: unknown, inputDescriptor: number[]) => {
  const embeddings = extractEmbeddings(faceEmbedding);
  if (embeddings.length === 0) {
    return { registered: false, matched: false, distance: null };
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  for (const embedding of embeddings) {
    if (embedding.length !== inputDescriptor.length) continue;
    const distance = euclideanDistance(inputDescriptor, embedding);
    if (distance < bestDistance) bestDistance = distance;
  }

  if (!Number.isFinite(bestDistance)) {
    return { registered: false, matched: false, distance: null };
  }

  return {
    registered: true,
    matched: bestDistance <= FACE_MATCH_THRESHOLD,
    distance: bestDistance,
  };
};

const findTeacherByUserId = async (userId: string) =>
  prisma.teacher.findUnique({
    where: { userId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      faceEmbedding: true,
      faceImageUrl: true,
      user: { select: { email: true } },
      classes: { select: { id: true, name: true } },
    },
  });

const buildTeacherPayload = (teacher: NonNullable<Awaited<ReturnType<typeof findTeacherByUserId>>>) => ({
  id: teacher.id,
  fullName: teacher.fullName,
  phone: teacher.phone,
  email: teacher.user?.email ?? null,
  classes: teacher.classes,
  faceImageUrl: teacher.faceImageUrl,
  hasFace: !!teacher.faceEmbedding,
});

const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const formatDateKey = (value: Date) => value.toISOString().slice(0, 10);

const addUtcDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

const getRangeDateKeys = (start: Date, end: Date) => {
  const dates: string[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addUtcDays(cursor, 1)) {
    dates.push(formatDateKey(cursor));
  }
  return dates;
};

const buildRangeRecap = async (start: Date, end: Date) => {
  const dateKeys = getRangeDateKeys(start, end);
  const teachers = await prisma.teacher.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      phone: true,
      user: { select: { email: true } },
      classes: { select: { id: true, name: true } },
      teacherAttendances: {
        where: { date: { gte: start, lte: end } },
        orderBy: { date: "asc" },
        select: { id: true, date: true, checkInTime: true, checkOutTime: true, notes: true },
      },
    },
  });

  let presentSlots = 0;
  let completeSlots = 0;
  let missingCheckOut = 0;

  const rows = teachers.map((teacher) => {
    const attendanceByDate = new Map(
      teacher.teacherAttendances.map((attendance) => [formatDateKey(attendance.date), attendance]),
    );
    const daily = dateKeys.map((dateKey) => {
      const attendance = attendanceByDate.get(dateKey) ?? null;
      const serialized = serializeTeacherAttendance(attendance);
      const status = getStatus(attendance);

      if (status !== "BELUM_ABSEN") presentSlots += 1;
      if (status === "SELESAI") completeSlots += 1;
      if (status === "SUDAH_DATANG") missingCheckOut += 1;

      return {
        date: dateKey,
        checkInTime: serialized?.checkInTime ?? null,
        checkOutTime: serialized?.checkOutTime ?? null,
        status,
      };
    });

    const present = daily.filter((item) => item.status !== "BELUM_ABSEN").length;
    const complete = daily.filter((item) => item.status === "SELESAI").length;
    const missingOut = daily.filter((item) => item.status === "SUDAH_DATANG").length;

    return {
      id: teacher.id,
      fullName: teacher.fullName,
      phone: teacher.phone,
      email: teacher.user?.email ?? null,
      classes: teacher.classes,
      totals: {
        present,
        complete,
        missingCheckOut: missingOut,
        absent: dateKeys.length - present,
      },
      daily,
    };
  });

  const totalSlots = teachers.length * dateKeys.length;

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    dates: dateKeys,
    stats: {
      totalTeachers: teachers.length,
      totalDays: dateKeys.length,
      totalSlots,
      presentSlots,
      completeSlots,
      missingCheckOut,
      absentSlots: totalSlots - presentSlots,
    },
    teachers: rows,
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureTeacherAttendanceTable();

  if (req.method === "GET") {
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";

    if (userId) {
      const date = parseDateKey(req.query.date);
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
        teacher: buildTeacherPayload(teacher),
        today: serializeTeacherAttendance(today),
        status: getStatus(today),
        recent: recent.map(serializeTeacherAttendance),
      });
    }

    const hasRange = isDateKey(req.query.start) || isDateKey(req.query.end);
    if (hasRange) {
      if (!isDateKey(req.query.start) || !isDateKey(req.query.end)) {
        return res.status(400).json({ error: "Tanggal awal dan akhir wajib valid" });
      }

      const start = parseDateKey(req.query.start);
      const end = parseDateKey(req.query.end);
      if (start > end) {
        return res.status(400).json({ error: "Tanggal awal tidak boleh melewati tanggal akhir" });
      }

      const totalDays = getRangeDateKeys(start, end).length;
      if (totalDays > 366) {
        return res.status(400).json({ error: "Rentang rekap maksimal 366 hari" });
      }

      return res.status(200).json(await buildRangeRecap(start, end));
    }

    const date = parseDateKey(req.query.date);
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
    const { userId, action, date: dateValue, descriptor } = req.body ?? {};
    const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
    const resolvedAction = typeof action === "string" ? action : "";

    if (!normalizedUserId) {
      return res.status(400).json({ error: "Akun guru tidak valid" });
    }

    if (resolvedAction !== "check-in" && resolvedAction !== "check-out") {
      return res.status(400).json({ error: "Aksi absensi tidak valid" });
    }

    const inputDescriptor = normalizeDescriptor(descriptor);
    if (!inputDescriptor) {
      return res.status(400).json({ error: "Data wajah tidak valid" });
    }

    const teacher = await findTeacherByUserId(normalizedUserId);
    if (!teacher) {
      return res.status(404).json({ error: "Akun guru belum terhubung dengan data pengajar" });
    }

    const faceMatch = matchFace(teacher.faceEmbedding, inputDescriptor);
    if (!faceMatch.registered) {
      return res.status(404).json({ error: "Wajah pengajar belum terdaftar" });
    }
    if (!faceMatch.matched) {
      return res.status(401).json({
        error: "Wajah tidak cocok dengan akun pengajar",
        distance: faceMatch.distance,
      });
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
        teacher: buildTeacherPayload(teacher),
        attendance: serializeTeacherAttendance(attendance),
        status: getStatus(attendance),
        distance: faceMatch.distance,
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
      teacher: buildTeacherPayload(teacher),
      attendance: serializeTeacherAttendance(attendance),
      status: getStatus(attendance),
      distance: faceMatch.distance,
    });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
