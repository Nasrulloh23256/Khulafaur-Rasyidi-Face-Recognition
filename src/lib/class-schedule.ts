export type ClassScheduleInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  teacherId: string;
};

export const scheduleDays = [
  { value: 0, label: "Senin", shortLabel: "Sen" },
  { value: 1, label: "Selasa", shortLabel: "Sel" },
  { value: 2, label: "Rabu", shortLabel: "Rab" },
  { value: 3, label: "Kamis", shortLabel: "Kam" },
  { value: 4, label: "Jumat", shortLabel: "Jum" },
  { value: 5, label: "Sabtu", shortLabel: "Sab" },
  { value: 6, label: "Minggu", shortLabel: "Min" },
] as const;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMinutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

export const parseClassSchedules = (
  value: unknown,
): { schedules: ClassScheduleInput[] | null; error: string | null } => {
  if (!Array.isArray(value) || value.length === 0) {
    return { schedules: null, error: "Pilih minimal satu hari jadwal bimbel" };
  }

  const schedules: ClassScheduleInput[] = [];
  const usedSlots = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { schedules: null, error: "Format jadwal tidak valid" };
    }

    const schedule = item as Partial<ClassScheduleInput>;
    if (
      !Number.isInteger(schedule.dayOfWeek) ||
      (schedule.dayOfWeek ?? -1) < 0 ||
      (schedule.dayOfWeek ?? 7) > 6 ||
      typeof schedule.startTime !== "string" ||
      typeof schedule.endTime !== "string" ||
      typeof schedule.teacherId !== "string" ||
      schedule.teacherId.trim() === "" ||
      !timePattern.test(schedule.startTime) ||
      !timePattern.test(schedule.endTime) ||
      toMinutes(schedule.startTime) >= toMinutes(schedule.endTime) ||
      usedSlots.has(`${schedule.dayOfWeek}-${schedule.startTime}-${schedule.endTime}`)
    ) {
      return { schedules: null, error: "Hari dan jam jadwal bimbel tidak valid" };
    }

    usedSlots.add(`${schedule.dayOfWeek}-${schedule.startTime}-${schedule.endTime}`);
    schedules.push({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      teacherId: schedule.teacherId.trim(),
    });
  }

  return {
    schedules: schedules.sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
    ),
    error: null,
  };
};

export const formatClassSchedules = (
  schedules: (Pick<ClassScheduleInput, "dayOfWeek" | "startTime" | "endTime"> & {
    teacher?: { fullName: string } | null;
  })[],
) =>
  [...schedules]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
    .map((schedule) => {
      const day = scheduleDays.find((item) => item.value === schedule.dayOfWeek)?.shortLabel ?? "-";
      return `${day} ${schedule.startTime}-${schedule.endTime}${schedule.teacher ? ` · ${schedule.teacher.fullName}` : ""}`;
    })
    .join(", ");

const getJakartaClock = (date: Date) => {
  // Asia/Jakarta is UTC+7 (7 * 60 * 60 * 1000 = 25,200,000 ms)
  const wibTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const utcDay = wibTime.getUTCDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday... 6 = Saturday
  // Map JS UTC day (Sun=0, Mon=1... Sun=6) to scheduleDays index (Mon=0, Tue=1... Sun=6):
  const dayOfWeek = utcDay === 0 ? 6 : utcDay - 1;
  const hours = wibTime.getUTCHours();
  const minutes = wibTime.getUTCMinutes();

  return {
    dayOfWeek,
    minutes: hours * 60 + minutes,
  };
};

export const getClassAttendanceScheduleStatus = (
  schedules: Pick<ClassScheduleInput, "dayOfWeek" | "startTime" | "endTime">[],
  now = new Date(),
) => {
  if (schedules.length === 0) {
    return { configured: false, isOpen: true, message: "Jadwal bimbel belum diatur" };
  }

  const clock = getJakartaClock(now);
  const todaySchedules = schedules.filter((schedule) => schedule.dayOfWeek === clock.dayOfWeek);
  if (todaySchedules.length === 0) {
    return { configured: true, isOpen: false, message: "Tidak ada jadwal bimbel untuk hari ini" };
  }

  const activeSchedule = todaySchedules.find(
    (schedule) => clock.minutes >= toMinutes(schedule.startTime) && clock.minutes <= toMinutes(schedule.endTime),
  );
  if (activeSchedule) {
    return {
      configured: true,
      isOpen: true,
      message: `Absensi dibuka sampai pukul ${activeSchedule.endTime} WIB`,
      schedule: activeSchedule,
    };
  }

  const hours = todaySchedules.map((schedule) => `${schedule.startTime}-${schedule.endTime}`).join(" atau ");
  return { configured: true, isOpen: false, message: `Absensi dibuka pukul ${hours} WIB` };
};
