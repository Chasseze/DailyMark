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

export interface QuizDay {
  key: string;
  date: Date;
  label: string;
  /** `null` when no round was played that day — an absence, not a nil score. */
  score: number | null;
}

export interface QuizWindow {
  /** One entry per calendar day, oldest → newest, gaps included. */
  days: QuizDay[];
  /** Length of the window in days, so `played` has a denominator. */
  span: number;
  /** Days in the window with a round on them. */
  played: number;
  best: number;
  /** Mean over the days actually played, one decimal. */
  average: number;
}

/**
 * Best score per calendar day across the last `span` days.
 *
 * The days with no round are kept as `null` rather than dropped. A series of
 * played days only closes its own gaps, so two rounds a fortnight apart end up
 * side by side reading as consecutive — the x axis has to be real time for the
 * shape to mean anything. Every summary number is scoped to the same window as
 * the days, so nothing in the panel can quote a figure the chart cannot show.
 */
export function quizWindow(rows: QuizRow[], span = 28, today = new Date()): QuizWindow {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const best = byDay.get(row.date_key);
    if (best === undefined || row.score > best) byDay.set(row.date_key, row.score);
  }

  const end = startOfDay(today);
  const days: QuizDay[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const key = dayKey(date);
    days.push({
      key,
      date,
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      score: byDay.get(key) ?? null,
    });
  }

  const scores = days.map((d) => d.score).filter((s): s is number => s !== null);
  return {
    days,
    span,
    played: scores.length,
    best: scores.length ? Math.max(...scores) : 0,
    average: scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0,
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

export interface WeekdayCount {
  /** Sunday is 0, matching `Date.getDay()`. */
  weekday: number;
  label: string;
  count: number;
}

/** Which weekdays the writing actually happens on. Sunday index 0. */
export function notesPerWeekday(notes: ReadonlyArray<Pick<Note, "created_at">>): WeekdayCount[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = Array(7).fill(0) as number[];
  for (const note of notes) {
    if (!note.created_at) continue;
    counts[new Date(note.created_at).getDay()] += 1;
  }
  return counts.map((count, weekday) => ({ weekday, label: labels[weekday], count }));
}

export interface Cadence {
  /** Notes per week over the window, oldest → newest, empty weeks included. */
  weeks: WeekBar[];
  /** The same notes broken down by weekday — never a wider set than `weeks`. */
  weekdays: WeekdayCount[];
  total: number;
  /** Notes a week over the whole window, one decimal. */
  perWeek: number;
  /** Every week tied at the busiest count; empty when nothing was written. */
  peak: WeekBar[];
  /** Every weekday tied at the busiest count; empty when nothing was written. */
  busiest: WeekdayCount[];
}

/**
 * The whole writing-cadence panel in one shape.
 *
 * Both halves of that panel are derived here so they cannot disagree: the
 * weekday bars used to count *every* note the account had while the headline
 * above them counted only the window, so the bars summed past their own total.
 *
 * `peak` and `busiest` are empty rather than defaulted, and hold every tie
 * rather than the first winner — an account with nothing written should not be
 * told its peak week was 1 and that it writes most on Sundays, and a genuine
 * tie should not have one of its days singled out.
 */
export function writingCadence(
  notes: ReadonlyArray<Pick<Note, "created_at">>,
  weeks: number,
  today = new Date()
): Cadence {
  const buckets = notesPerWeek(notes, weeks, today);
  const keys = new Set(buckets.map((b) => b.key));
  // Membership is decided by the same week key `notesPerWeek` buckets on, so
  // the weekday breakdown covers exactly the notes the trend line drew.
  const inWindow = notes.filter((note) => {
    if (!note.created_at) return false;
    const created = startOfDay(new Date(note.created_at));
    return keys.has(dayKey(addDays(created, -created.getDay())));
  });

  const weekdays = notesPerWeekday(inWindow);
  const total = buckets.reduce((a, b) => a + b.count, 0);
  const topOf = <T extends { count: number }>(rows: T[]): T[] => {
    const max = Math.max(...rows.map((r) => r.count), 0);
    return max > 0 ? rows.filter((r) => r.count === max) : [];
  };

  return {
    weeks: buckets,
    weekdays,
    total,
    perWeek: weeks > 0 ? Math.round((total / weeks) * 10) / 10 : 0,
    peak: topOf(buckets),
    busiest: topOf(weekdays),
  };
}
