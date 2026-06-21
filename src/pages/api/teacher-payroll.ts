import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { ensureTeacherAttendanceTable, formatTeacherAttendanceTime, parseDateKey } from "@/lib/teacher-attendance";
import {
  ensureTeacherPayrollTable,
  formatDateKey,
  getPayrollRange,
  getTeacherPayrollSetting,
  normalizePayrollPeriod,
  type PayrollPeriod,
} from "@/lib/teacher-payroll";

const toHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

const getWorkedMinutes = (attendance: { checkInTime: Date | null; checkOutTime: Date | null }) => {
  if (!attendance.checkInTime || !attendance.checkOutTime) return 0;
  const diff = attendance.checkOutTime.getTime() - attendance.checkInTime.getTime();
  return Math.max(0, Math.round(diff / 60000));
};

const getSettingPayload = (setting: { id: string; hourlyRate: number; period: string; updatedAt: Date }) => ({
  id: setting.id,
  hourlyRate: setting.hourlyRate,
  period: normalizePayrollPeriod(setting.period) ?? "MONTHLY",
  updatedAt: setting.updatedAt.toISOString(),
});

const getPeriodLabel = (period: PayrollPeriod) => (period === "WEEKLY" ? "Mingguan" : "Bulanan");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await Promise.all([ensureTeacherAttendanceTable(), ensureTeacherPayrollTable()]);

  if (req.method === "GET") {
    const setting = await getTeacherPayrollSetting();
    const period = normalizePayrollPeriod(setting.period) ?? "MONTHLY";
    const anchorDate = parseDateKey(req.query.date);
    const { start, end } = getPayrollRange(period, anchorDate);
    const teacherId =
      typeof req.query.teacherId === "string" && req.query.teacherId !== "all"
        ? req.query.teacherId.trim()
        : "";

    const [teacherOptions, teachers] = await Promise.all([
      prisma.teacher.findMany({
        orderBy: { fullName: "asc" },
        select: {
          id: true,
          fullName: true,
        },
      }),
      prisma.teacher.findMany({
        where: teacherId ? { id: teacherId } : undefined,
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
            select: {
              id: true,
              date: true,
              checkInTime: true,
              checkOutTime: true,
            },
          },
        },
      }),
    ]);

    let totalMinutes = 0;
    let totalPay = 0;
    let completeAttendances = 0;
    let incompleteAttendances = 0;

    const rows = teachers.map((teacher) => {
      let teacherMinutes = 0;
      let teacherPay = 0;
      let teacherComplete = 0;
      let teacherIncomplete = 0;

      const daily = teacher.teacherAttendances.map((attendance) => {
        const workedMinutes = getWorkedMinutes(attendance);
        const isComplete = workedMinutes > 0;
        const pay = Math.round((workedMinutes / 60) * setting.hourlyRate);

        if (isComplete) {
          teacherComplete += 1;
          completeAttendances += 1;
        } else {
          teacherIncomplete += 1;
          incompleteAttendances += 1;
        }

        teacherMinutes += workedMinutes;
        teacherPay += pay;
        totalMinutes += workedMinutes;
        totalPay += pay;

        return {
          id: attendance.id,
          date: formatDateKey(attendance.date),
          checkInTime: formatTeacherAttendanceTime(attendance.checkInTime),
          checkOutTime: formatTeacherAttendanceTime(attendance.checkOutTime),
          workedMinutes,
          workedHours: toHours(workedMinutes),
          pay,
          status: isComplete ? "LENGKAP" : "BELUM_KELUAR",
        };
      });

      return {
        id: teacher.id,
        fullName: teacher.fullName,
        phone: teacher.phone,
        email: teacher.user?.email ?? null,
        classes: teacher.classes,
        totals: {
          completeAttendances: teacherComplete,
          incompleteAttendances: teacherIncomplete,
          workedMinutes: teacherMinutes,
          workedHours: toHours(teacherMinutes),
          pay: teacherPay,
        },
        daily,
      };
    });

    return res.status(200).json({
      setting: getSettingPayload(setting),
      period: {
        type: period,
        label: getPeriodLabel(period),
        anchorDate: formatDateKey(anchorDate),
        start: formatDateKey(start),
        end: formatDateKey(end),
      },
      teacherOptions,
      stats: {
        totalTeachers: rows.length,
        completeAttendances,
        incompleteAttendances,
        workedMinutes: totalMinutes,
        workedHours: toHours(totalMinutes),
        totalPay,
      },
      teachers: rows,
    });
  }

  if (req.method === "PATCH") {
    const hourlyRateValue = Number(req.body?.hourlyRate);
    const period = normalizePayrollPeriod(req.body?.period);

    if (!Number.isFinite(hourlyRateValue) || hourlyRateValue < 0) {
      return res.status(400).json({ error: "Tarif per jam tidak valid" });
    }

    if (!period) {
      return res.status(400).json({ error: "Periode penggajian tidak valid" });
    }

    const current = await getTeacherPayrollSetting();
    const setting = await prisma.teacherPayrollSetting.update({
      where: { id: current.id },
      data: {
        hourlyRate: Math.round(hourlyRateValue),
        period,
      },
    });

    return res.status(200).json({ setting: getSettingPayload(setting) });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
