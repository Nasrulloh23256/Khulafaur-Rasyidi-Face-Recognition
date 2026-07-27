import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type SaveBase64ImageOptions = {
  folder?: string;
  maxBytes?: number;
};

export const saveBase64Image = async (
  dataUrl: string,
  { folder = "uploads", maxBytes = DEFAULT_MAX_IMAGE_BYTES }: SaveBase64ImageOptions = {},
) => {
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) {
    throw new Error("INVALID_FORMAT");
  }

  const ext = match[2] === "jpeg" ? "jpg" : match[2];
  const buffer = Buffer.from(match[3], "base64");
  if (buffer.length > maxBytes) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  if (process.env.VERCEL) {
    return dataUrl;
  }

  const uploadDir = path.join(process.cwd(), "public", folder);
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(uploadDir, filename), buffer);
    return `/${folder.replace(/\\/g, "/")}/${filename}`;
  } catch (error) {
    const maybeError = error as NodeJS.ErrnoException;
    if (maybeError?.code === "EROFS" || maybeError?.code === "EACCES") {
      return dataUrl;
    }
    throw error;
  }
};
