/**
 * Aggregations behind the Rhythm tab.
 *
 * Everything here is pure: it takes rows already fetched and returns shapes the
 * page renders directly. Keeping it out of the component is what makes the
 * date arithmetic — which is where this kind of feature usually goes wrong —
 * testable without a browser.
 *
 * All day keys are local `YYYY-MM-DD`, matching `dateKey()` in quiz.ts and the
 * `date_key` columns in `daily_moods` / `quiz_progress`.
 */

import { MOOD_VALENCE, isDailyMood, type DailyMood, type MoodValence } from "./mood-scale";
import type { Note, Notebook } from "./types";

export interface MoodRow {
  date_key: string;
  mood: string;
  note?: string;
}

export interface QuizRow {
  date_key: string;
  score: number;
  attempt: number;
}

const MS_PER_DAY = 86_400_000;

/** Local calendar day key — never `toISOString()`, which silently shifts in UTC-negative zones. */
export function dayKey(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Midnight local, so day maths never drifts by an hour across a DST boundary. */
export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export interface RhythmDay {
  key: string;
  date: Date;
  mood: DailyMood | null;
  moodNote: string;
  /** True when anything happened that day, mood logged or not. */
  active: boolean;
}

export interface RhythmWeek {
  /** Sunday-first, always seven entries; leading days before `from` are null. */
  days: (RhythmDay | null)[];
  /** Month label shown above the column when the month changes. */
  monthLabel: string | null;
}

/**
 * A Sunday-aligned grid covering the last `days` days ending today, so the
 * calendar reads in columns of weeks the way a habit tracker should.
 */
export function buildCalendar(
  days: number,
  opts: {
    today?: Date;
    moods?: MoodRow[];
    quizzes?: QuizRow[];
    notes?: ReadonlyArray<Pick<Note, "created_at" | "updated_at">>;
  } = {}
): RhythmWeek[] {
  const today = startOfDay(opts.today ?? new Date());
  const first = addDays(today, -(days - 1));
  // Back up to the Sunday on or before the first day.
  const gridStart = addDays(first, -first.getDay());

  const moodByDay = new Map<string, MoodRow>();
  for (const row of opts.moods ?? []) moodByDay.set(row.date_key, row);

  const activeDays = new Set<string>();
  for (const row of opts.moods ?? []) activeDays.add(row.date_key);
  for (const row of opts.quizzes ?? []) activeDays.add(row.date_key);
  for (const note of opts.notes ?? []) {
    for (const stamp of [note.created_at, note.updated_at]) {
      if (stamp) activeDays.add(dayKey(new Date(stamp)));
    }
  }

  const weeks: RhythmWeek[] = [];
  let cursor = gridStart;
  let lastMonth = -1;

  while (cursor <= today) {
    const week: (RhythmDay | null)[] = [];
    let monthLabel: string | null = null;

    for (let i = 0; i < 7; i++) {
      const date = addDays(cursor, i);
      if (date < first || date > today) {
        week.push(null);
        continue;
      }
      const key = dayKey(date);
      const row = moodByDay.get(key);
      const mood = row && isDailyMood(row.mood) ? row.mood : null;
      if (date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth();
        monthLabel = date.toLocaleDateString(undefined, { month: "short" });
      }
      week.push({ key, date, mood, moodNote: row?.note ?? "", active: activeDays.has(key) });
    }

    weeks.push({ days: week, monthLabel });
    cursor = addDays(cursor, 7);
  }

  return weeks;
}

export interface MoodTally {
  mood: DailyMood;
  valence: MoodValence;
  count: number;
  /** Share of all logged check-ins, 0–1. */
  share: number;
}

export function tallyMoods(moods: MoodRow[]): { total: number; tallies: MoodTally[] } {
  const counts = new Map<DailyMood, number>();
  for (const row of moods) {
    if (!isDailyMood(row.mood)) continue;
    counts.set(row.mood, (counts.get(row.mood) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const tallies = [...counts.entries()]
    .map(([mood, count]) => ({
      mood,
      valence: MOOD_VALENCE[mood],
      count,
      share: total ? count / total : 0,
    }))
    .sort((a, b) => a.valence - b.valence || a.mood.localeCompare(b.mood));
  return { total, tallies };
}

/** Longest run of consecutive active days anywhere in the window. */
export function longestStreak(activeKeys: Iterable<string>): number {
  const days = [...new Set(activeKeys)].sort();
  let best = 0;
  let run = 0;
  let previous: number | null = null;

  for (const key of days) {
    const time = startOfDay(new Date(`${key}T12:00:00`)).getTime();
    run = previous !== null && Math.round((time - previous) / MS_PER_DAY) === 1 ? run + 1 : 1;
    previous = time;
    if (run > best) best = run;
  }
  return best;
}

export interface WeekBar {
  /** Key of that week's Sunday. */
  key: string;
  label: string;
  count: number;
}

/** Notes created per week, oldest → newest, including empty weeks. */
export function notesPerWeek(
  notes: ReadonlyArray<Pick<Note, "created_at">>,
  weeks: number,
  today = new Date()
): WeekBar[] {
  const end = startOfDay(today);
  const thisSunday = addDays(end, -end.getDay());
  const buckets: WeekBar[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisSunday, -7 * i);
    buckets.push({
      key: dayKey(start),
      label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: 0,
    });
  }

  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const note of notes) {
    if (!note.created_at) continue;
    const created = startOfDay(new Date(note.created_at));
    const sunday = dayKey(addDays(created, -created.getDay()));
    const at = index.get(sunday);
    if (at !== undefined) buckets[at].count += 1;
  }
  return buckets;
}

export interface Ranked {
  label: string;
  count: number;
  /** Notebook colour where there is one; tags have none. */
  color?: string;
}

export function topTags(notes: ReadonlyArray<Pick<Note, "tags">>, limit = 6): Ranked[] {
  const counts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function topNotebooks(
  notes: ReadonlyArray<Pick<Note, "notebook_id">>,
  notebooks: ReadonlyArray<Notebook>,
  limit = 6
): Ranked[] {
  const counts = new Map<string, number>();
  for (const note of notes) {
    if (!note.notebook_id) continue;
    counts.set(note.notebook_id, (counts.get(note.notebook_id) ?? 0) + 1);
  }
  return notebooks
    .map((nb) => ({ label: nb.name, count: counts.get(nb.id) ?? 0, color: nb.color }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export interface QuizStats {
  played: number;
  best: number;
  average: number;
  series: { key: string; label: string; score: number }[];
}

/**
 * Only finished rounds count. A row still sitting in `ready`/`question` would
 * otherwise drag the average down with a score the user has not earned yet —
 * `phase` is not selected here, so completeness is inferred from a non-zero
 * attempt having reached a score, which is what the finished rows carry.
 */
export function quizStats(rows: QuizRow[], limit = 14): QuizStats {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const best = byDay.get(row.date_key);
    if (best === undefined || row.score > best) byDay.set(row.date_key, row.score);
  }

  const ordered = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const scores = ordered.map(([, score]) => score);

  return {
    played: ordered.length,
    best: scores.length ? Math.max(...scores) : 0,
    average: scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0,
    series: ordered.slice(-limit).map(([key, score]) => ({
      key,
      label: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      score,
    })),
  };
}

/**
 * How much history there actually is, in days, counting from the earliest
 * thing the user did. A brand-new account should not be told it has an
 * 84-day record with 80 empty squares in it.
 */
export function historySpan(
  opts: {
    today?: Date;
    moods?: MoodRow[];
    quizzes?: QuizRow[];
    notes?: ReadonlyArray<Pick<Note, "created_at">>;
  },
  { min = 28, max = 84 }: { min?: number; max?: number } = {}
): number {
  const today = startOfDay(opts.today ?? new Date());
  let earliest: number | null = null;

  const consider = (time: number) => {
    if (Number.isNaN(time)) return;
    if (earliest === null || time < earliest) earliest = time;
  };

  // Day keys are parsed at noon to dodge DST, then floored — comparing a noon
  // timestamp against a midnight `today` loses half a day and the span comes
  // out one short.
  const fromKey = (key: string) => startOfDay(new Date(`${key}T12:00:00`)).getTime();
  for (const row of opts.moods ?? []) consider(fromKey(row.date_key));
  for (const row of opts.quizzes ?? []) consider(fromKey(row.date_key));
  for (const note of opts.notes ?? []) {
    if (note.created_at) consider(startOfDay(new Date(note.created_at)).getTime());
  }

  if (earliest === null) return min;
  const span = Math.floor((today.getTime() - earliest) / MS_PER_DAY) + 1;
  return Math.min(Math.max(span, min), max);
}

export interface MonthGrid {
  year: number;
  month: number;
  label: string;
  /** Six rows at most, Sunday-first; null pads the days outside the month. */
  weeks: (RhythmDay | null)[][];
}

/** Calendar-page view of one month, for the heatmap. */
export function buildMonth(
  year: number,
  month: number,
  opts: {
    today?: Date;
    moods?: MoodRow[];
    quizzes?: QuizRow[];
    notes?: ReadonlyArray<Pick<Note, "created_at" | "updated_at">>;
  } = {}
): MonthGrid {
  const today = startOfDay(opts.today ?? new Date());
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const moodByDay = new Map<string, MoodRow>();
  for (const row of opts.moods ?? []) moodByDay.set(row.date_key, row);

  const activeDays = new Set<string>();
  for (const row of opts.moods ?? []) activeDays.add(row.date_key);
  for (const row of opts.quizzes ?? []) activeDays.add(row.date_key);
  for (const note of opts.notes ?? []) {
    for (const stamp of [note.created_at, note.updated_at]) {
      if (stamp) activeDays.add(dayKey(new Date(stamp)));
    }
  }

  const cells: (RhythmDay | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date > today) {
      cells.push(null);
      continue;
    }
    const key = dayKey(date);
    const row = moodByDay.get(key);
    cells.push({
      key,
      date,
      mood: row && isDailyMood(row.mood) ? row.mood : null,
      moodNote: row?.note ?? "",
      active: activeDays.has(key),
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (RhythmDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return {
    year,
    month,
    label: first.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    weeks,
  };
}

/** Which weekdays the writing actually happens on. Sunday index 0. */
export function notesPerWeekday(
  notes: ReadonlyArray<Pick<Note, "created_at">>
): { weekday: number; label: string; count: number }[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = Array(7).fill(0) as number[];
  for (const note of notes) {
    if (!note.created_at) continue;
    counts[new Date(note.created_at).getDay()] += 1;
  }
  return counts.map((count, weekday) => ({ weekday, label: labels[weekday], count }));
}
