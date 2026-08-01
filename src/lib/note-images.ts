import { requireSupabase } from "./supabase";

const BUCKET = "note-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

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

/** Upload an image into the note-images bucket and return its public URL. */
export async function uploadNoteImage(
  userId: string,
  noteId: string,
  file: File
): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Use a JPEG, PNG, GIF, or WebP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Images must be 5 MB or smaller.");
  }

  const db = requireSupabase();
  const ext = extensionFor(file.type);
  const path = `${userId}/${noteId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await db.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
