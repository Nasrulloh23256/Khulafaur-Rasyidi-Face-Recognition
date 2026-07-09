type WhatsAppNotificationResult =
  | { sent: true; providerMessageId?: string }
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
};

const getWhatsAppConfig = () => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || "v22.0";
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim() ?? "";
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "id";
  const explicitEnabled = process.env.WHATSAPP_ENABLED?.trim().toLowerCase();
  const enabled = explicitEnabled === "false" ? false : !!accessToken && !!phoneNumberId;

  return {
    accessToken,
    phoneNumberId,
    apiVersion,
    templateName,
    templateLanguage,
    enabled,
  };
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
    "Notifikasi Absensi Ohm Study Club",
    "",
    `Siswa: ${input.studentName}`,
    `Kelas: ${input.className}`,
    `Jam hadir: ${input.checkInTime}`,
    `Area: ${input.areaStatus}`,
    "",
    `Bukti foto: ${input.photoUrl}`,
    `Lokasi: ${input.mapsUrl}`,
  ].join("\n");

const buildTemplatePayload = (
  to: string,
  input: StudentAttendanceNotificationInput,
  templateName: string,
  templateLanguage: string,
) => ({
  messaging_product: "whatsapp",
  to,
  type: "template",
  template: {
    name: templateName,
    language: { code: templateLanguage },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: input.studentName },
          { type: "text", text: input.className },
          { type: "text", text: input.checkInTime },
          { type: "text", text: input.areaStatus },
          { type: "text", text: input.photoUrl },
          { type: "text", text: input.mapsUrl },
        ],
      },
    ],
  },
});

const buildTextPayload = (to: string, input: StudentAttendanceNotificationInput) => ({
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to,
  type: "text",
  text: {
    preview_url: true,
    body: buildAttendanceMessage(input),
  },
});

export const sendStudentAttendanceWhatsApp = async (
  input: StudentAttendanceNotificationInput,
): Promise<WhatsAppNotificationResult> => {
  const config = getWhatsAppConfig();
  if (!config.enabled) {
    return { sent: false, skipped: true, reason: "WhatsApp belum dikonfigurasi" };
  }

  const to = normalizeWhatsAppPhone(input.to);
  if (!to) {
    return { sent: false, skipped: true, reason: "Nomor WhatsApp orang tua kosong" };
  }

  const payload = config.templateName
    ? buildTemplatePayload(to, input, config.templateName, config.templateLanguage)
    : buildTextPayload(to, input);

  try {
    const response = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        typeof data?.error?.message === "string"
          ? data.error.message
          : `WhatsApp API error ${response.status}`;
      return { sent: false, skipped: false, reason: message };
    }

    return {
      sent: true,
      providerMessageId: typeof data?.messages?.[0]?.id === "string" ? data.messages[0].id : undefined,
    };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      reason: error instanceof Error ? error.message : "Gagal mengirim WhatsApp",
    };
  }
};
