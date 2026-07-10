type WhatsAppNotificationResult =
  | { sent: true; providerMessageId?: string; locationSent: true }
  | { sent: true; providerMessageId?: string; locationSent: false; reason: string }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; reason: string };

type StudentAttendanceNotificationInput = {
  to: string | null | undefined;
  studentName: string;
  className: string;
  checkInTime: string;
  areaStatus: string;
  photoUrl: string;
  mapsUrl: string;
  latitude: number;
  longitude: number;
};

const getFonnteConfig = () => {
  const token = process.env.FONNTE_TOKEN?.trim() ?? "";
  const apiUrl = process.env.FONNTE_API_URL?.trim() || "https://api.fonnte.com/send";
  const explicitEnabled = process.env.FONNTE_ENABLED?.trim().toLowerCase();
  const enabled = explicitEnabled === "false" ? false : !!token;

  return { token, apiUrl, enabled, explicitEnabled };
};

export const normalizeWhatsAppPhone = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
};

const buildAttendanceMessage = (input: StudentAttendanceNotificationInput) =>
  [
    "*Notifikasi Absensi Ohm Study Club*",
    "",
    `Nama siswa: ${input.studentName}`,
    `Kelas: ${input.className}`,
    "Kehadiran: Hadir",
    `Jam hadir: ${input.checkInTime}`,
    `Status lokasi: ${input.areaStatus}`,
    "",
    `Bukti foto: ${input.photoUrl}`,
    `Google Maps: ${input.mapsUrl}`,
    "",
    "Pin lokasi absensi dikirim pada pesan berikutnya.",
  ].join("\n");

const getFonnteDetail = (data: unknown, fallback: string) => {
  if (!data || typeof data !== "object") return fallback;
  const detail = (data as { detail?: unknown }).detail;
  return typeof detail === "string" && detail.trim() !== "" ? detail : fallback;
};

const getFonnteMessageId = (data: unknown) => {
  if (!data || typeof data !== "object") return undefined;
  const id = (data as { id?: unknown }).id;
  return Array.isArray(id) && typeof id[0] === "string" ? id[0] : undefined;
};

const sendFonnteRequest = async (config: ReturnType<typeof getFonnteConfig>, formData: FormData) => {
  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: { Authorization: config.token },
      body: formData,
    });
    const data: unknown = await response.json().catch(() => null);
    const isSuccess =
      response.ok &&
      !!data &&
      typeof data === "object" &&
      (data as { status?: unknown }).status === true;

    if (!isSuccess) {
      return {
        success: false as const,
        reason: getFonnteDetail(data, `Fonnte API error ${response.status}`),
      };
    }

    return { success: true as const, providerMessageId: getFonnteMessageId(data) };
  } catch (error) {
    return {
      success: false as const,
      reason: error instanceof Error ? error.message : "Gagal mengirim WhatsApp melalui Fonnte",
    };
  }
};

const createFonnteFormData = (target: string) => {
  const formData = new FormData();
  formData.set("target", target);
  formData.set("countryCode", "0");
  formData.set("connectOnly", "true");
  return formData;
};

export const sendStudentAttendanceWhatsApp = async (
  input: StudentAttendanceNotificationInput,
): Promise<WhatsAppNotificationResult> => {
  const config = getFonnteConfig();
  if (!config.enabled) {
    return {
      sent: false,
      skipped: true,
      reason:
        config.explicitEnabled === "false"
          ? "FONNTE_ENABLED bernilai false pada deployment Vercel"
          : "FONNTE_TOKEN belum terbaca pada deployment Vercel",
    };
  }

  const to = normalizeWhatsAppPhone(input.to);
  if (!to) {
    return { sent: false, skipped: true, reason: "Nomor WhatsApp orang tua kosong" };
  }

  const messageFormData = createFonnteFormData(to);
  messageFormData.set("message", buildAttendanceMessage(input));
  const messageResult = await sendFonnteRequest(config, messageFormData);
  if (!messageResult.success) {
    return {
      sent: false,
      skipped: false,
      reason: messageResult.reason,
    };
  }

  const locationFormData = createFonnteFormData(to);
  locationFormData.set("location", `${input.latitude},${input.longitude}`);
  const locationResult = await sendFonnteRequest(config, locationFormData);
  if (!locationResult.success) {
    return {
      sent: true,
      providerMessageId: messageResult.providerMessageId,
      locationSent: false,
      reason: `Rincian absensi telah terkirim, tetapi pin lokasi gagal dikirim: ${locationResult.reason}`,
    };
  }

  return { sent: true, providerMessageId: messageResult.providerMessageId, locationSent: true };
};
