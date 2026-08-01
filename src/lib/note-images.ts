import { requireSupabase } from "./supabase";

const BUCKET = "note-images";
/** Reject absurd camera dumps before we try to decode them. */
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
/** Soft ceiling after compression — Storage bucket allows 5 MB. */
const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024;
const MAX_EDGE = 1600;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/**
 * Scale an image so the longer edge fits inside `maxEdge`, keeping aspect ratio.
 * Already-smaller images are left unchanged.
 */
export function fitContain(
  width: number,
  height: number,
  maxEdge = MAX_EDGE
): { width: number; height: number; scale: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0, scale: 0 };
  const longest = Math.max(width, height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality)
  );
  if (!blob) throw new Error("Could not compress that image.");
  return blob;
}

/**
 * Resize + re-encode an attachment so it fits the note column and stays light.
 * Output is WebP when the browser supports it, otherwise JPEG.
 */
export async function compressNoteImage(file: File): Promise<File> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Use a JPEG, PNG, GIF, or WebP image.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Images must be 20 MB or smaller before compression.");
  }

  const img = await loadImage(file);
  const { width, height } = fitContain(img.naturalWidth, img.naturalHeight, MAX_EDGE);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not compress that image.");
  ctx.drawImage(img, 0, 0, width, height);

  const preferWebp =
    typeof canvas.toDataURL === "function" &&
    canvas.toDataURL("image/webp").startsWith("data:image/webp");
  const type = preferWebp ? "image/webp" : "image/jpeg";
  const ext = preferWebp ? "webp" : "jpg";

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, type, quality);
  while (blob.size > MAX_UPLOAD_BYTES && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, type, quality);
  }

  // If the original is already tiny and smaller than our encode, keep it —
  // but only when it already fits the max edge (no resize needed).
  if (
    file.size < blob.size &&
    file.type !== "image/gif" &&
    img.naturalWidth <= MAX_EDGE &&
    img.naturalHeight <= MAX_EDGE
  ) {
    return file;
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.${ext}`, { type, lastModified: Date.now() });
}

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

/** Compress, then upload into the note-images bucket and return its public URL. */
export async function uploadNoteImage(
  userId: string,
  noteId: string,
  file: File
): Promise<string> {
  const compressed = await compressNoteImage(file);
  if (compressed.size > 5 * 1024 * 1024) {
    throw new Error("Could not compress that image enough to upload.");
  }

  const db = requireSupabase();
  const ext = extensionFor(compressed.type);
  const path = `${userId}/${noteId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await db.storage.from(BUCKET).upload(path, compressed, {
    cacheControl: "3600",
    upsert: false,
    contentType: compressed.type,
  });
  if (error) throw error;

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
