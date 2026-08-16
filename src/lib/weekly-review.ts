import type { Note } from "./types";
import type { MoodRow, QuizRow } from "./rhythm";
import { dayKey } from "./rhythm";
import type { ReturnHistoryRow } from "./return-queue";

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

/** Build a weekly review Markdown body from notes, streak, Return, mood, quiz. */
export function buildWeeklyReviewMarkdown(opts: {
  notes: Note[];
  streak: number | null;
  when?: Date;
  moods?: MoodRow[];
  quizzes?: QuizRow[];
  returns?: ReturnHistoryRow[];
  savedThoughts?: number;
}): { title: string; content: string } {
  const when = opts.when ?? new Date();
  const { start, end } = weekBounds(when);
  const weekNotes = opts.notes.filter((n) => {
    const t = new Date(n.updated_at).getTime();
    return t >= start.getTime() && t < end.getTime();
  });

  const localStart = dayKey(start);
  const localEnd = dayKey(end);

  const weekMoods = (opts.moods ?? []).filter(
    (m) => m.date_key >= localStart && m.date_key < localEnd
  );
  const weekQuizzes = (opts.quizzes ?? []).filter(
    (q) => q.date_key >= localStart && q.date_key < localEnd
  );
  const weekReturns = (opts.returns ?? []).filter(
    (r) => r.dateKey >= localStart && r.dateKey < localEnd
  );
  const returnMarks = weekReturns.reduce((n, row) => n + row.doneIds.length, 0);

  const lines = [
    `A quiet look back at the week of ${weekOfLabel(when)}.`,
    "",
    `**Streak:** ${opts.streak ?? "–"} day${opts.streak === 1 ? "" : "s"}`,
    `**Notes touched:** ${weekNotes.length}`,
    `**Mood check-ins:** ${weekMoods.length}`,
    `**Quiz days:** ${weekQuizzes.length}`,
    `**Return marks:** ${returnMarks}`,
  ];
  if (opts.savedThoughts != null) {
    lines.push(`**Thoughts saved:** ${opts.savedThoughts}`);
  }
  lines.push("", "### Highlights", "");

  if (weekNotes.length === 0) {
    lines.push("_No notes updated this week yet._", "");
  } else {
    for (const note of weekNotes.slice(0, 12)) {
      const title = note.title.trim() || "Untitled";
      lines.push(`- [[${title}]]`);
    }
    lines.push("");
  }

  if (weekReturns.length > 0) {
    lines.push("### Return evenings", "");
    for (const row of weekReturns) {
      lines.push(
        `- ${row.dateKey}: ${row.doneIds.length} of ${row.queuedIds.length} marks`
      );
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
