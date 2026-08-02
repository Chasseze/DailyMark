import type { Note } from "./types";

/** ISO week label like “Week of Aug 2, 2026”. */
export function weekOfLabel(d = new Date()): string {
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() + mondayOffset);
  return monday.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function weekBounds(d = new Date()): { start: Date; end: Date } {
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(d.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

/** Build a weekly review Markdown body from recent notes + streak. */
export function buildWeeklyReviewMarkdown(opts: {
  notes: Note[];
  streak: number | null;
  when?: Date;
}): { title: string; content: string } {
  const when = opts.when ?? new Date();
  const { start, end } = weekBounds(when);
  const weekNotes = opts.notes.filter((n) => {
    const t = new Date(n.updated_at).getTime();
    return t >= start.getTime() && t < end.getTime();
  });

  const lines = [
    `A quiet look back at the week of ${weekOfLabel(when)}.`,
    "",
    `**Streak:** ${opts.streak ?? "–"} day${opts.streak === 1 ? "" : "s"}`,
    `**Notes touched:** ${weekNotes.length}`,
    "",
    "### Highlights",
    "",
  ];

  if (weekNotes.length === 0) {
    lines.push("_No notes updated this week yet._", "");
  } else {
    for (const note of weekNotes.slice(0, 12)) {
      const title = note.title.trim() || "Untitled";
      lines.push(`- [[${title}]]`);
    }
    lines.push("");
  }

  lines.push(
    "### Prompts",
    "",
    "- What felt heavy?",
    "- What felt clear?",
    "- What do I want more of next week?",
    "",
    "### One intention",
    "",
    ""
  );

  return {
    title: `Weekly review · ${weekOfLabel(when)}`,
    content: lines.join("\n"),
  };
}
