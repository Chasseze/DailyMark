/** Explicit recovery copies, never an automatic offline write queue. */
const PREFIX = "DailyMarkRecovery/";
export type Draft = { title: string; content: string; updatedAt: string };
export function readDraft(user: string, id: string): Draft | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(PREFIX + user + "/" + id) ?? "null",
    );
    return value &&
      typeof value.title === "string" &&
      typeof value.content === "string" &&
      typeof value.updatedAt === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
export function writeDraft(user: string, id: string, draft: Draft) {
  localStorage.setItem(PREFIX + user + "/" + id, JSON.stringify(draft));
}
export function removeDraft(user: string, id: string) {
  try {
    localStorage.removeItem(PREFIX + user + "/" + id);
  } catch {
    /* Storage disabled. */
  }
}
export function clearDrafts() {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {
    /* Storage disabled. */
  }
}
