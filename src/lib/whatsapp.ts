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
  const detail = (data as { detail?: unknown; reason?: unknown }).detail ?? (data as { reason?: unknown }).reason;
  return typeof detail === "string" && detail.trim() !== "" ? detail : fallback;
};

const getFonnteMessageId = (data: unknown) => {
  if (!data || typeof data !== "object") return undefined;
  const id = (data as { id?: unknown }).id;
  return Array.isArray(id) && typeof id[0] === "string" ? id[0] : undefined;
};

const sendFonnteRequest = async (config: ReturnType<typeof getFonnteConfig>, params: URLSearchParams) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: config.token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data: unknown = await response.json().catch(() => null);
    const isSuccess =
      response.ok &&
      !!data &&
      typeof data === "object" &&
      (data as { status?: unknown }).status === true;

    if (!isSuccess) {
      return {
        success: false as const,
        reason: getFonnteDetail(data, `Fonnte API error HTTP ${response.status}`),
      };
    }

    return { success: true as const, providerMessageId: getFonnteMessageId(data) };
  } catch (error) {
    let reason = "Gagal mengirim WhatsApp melalui Fonnte";
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        reason = "Koneksi ke Fonnte timeout (lebih dari 12 detik). Periksa koneksi internet.";
      } else if (error.message === "fetch failed") {
        const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
        const detail = cause?.code || cause?.message || "";
        reason = detail
          ? `Gagal terhubung ke Fonnte (${detail}). Pastikan koneksi internet aktif dan api.fonnte.com dapat diakses.`
          : "Gagal terhubung ke server Fonnte (api.fonnte.com). Pastikan server/aplikasi memiliki koneksi internet.";
      } else {
        reason = error.message;
      }
    }
    return {
      success: false as const,
      reason,
    };
  }
};

const createFonnteParams = (target: string) => {
  const params = new URLSearchParams();
  params.set("target", target);
  params.set("countryCode", "62");
  return params;
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
          ? "FONNTE_ENABLED bernilai false di .env"
          : "FONNTE_TOKEN belum dikonfigurasi di .env. Silakan isi FONNTE_TOKEN dari Fonnte.com",
    };
  }

  const to = normalizeWhatsAppPhone(input.to);
  if (!to) {
    return { sent: false, skipped: true, reason: "Nomor WhatsApp orang tua/wali belum diisi pada data siswa" };
  }

  const messageParams = createFonnteParams(to);
  messageParams.set("message", buildAttendanceMessage(input));
  const messageResult = await sendFonnteRequest(config, messageParams);
  if (!messageResult.success) {
    return {
      sent: false,
      skipped: false,
      reason: messageResult.reason,
    };
  }

  const locationParams = createFonnteParams(to);
  locationParams.set("location", `${input.latitude},${input.longitude}`);
  const locationResult = await sendFonnteRequest(config, locationParams);
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

