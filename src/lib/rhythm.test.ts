import { describe, expect, it } from "vitest";
import {
  addDays,
  buildCalendar,
  dayKey,
  longestStreak,
  notesPerWeek,
  quizStats,
  tallyMoods,
  topNotebooks,
  topTags,
} from "./rhythm";
import type { Note, Notebook } from "./types";

function note(partial: Partial<Note>): Note {
  return {
    id: "n1",
    user_id: "u1",
    notebook_id: null,
    title: "",
    content: "",
    preview: "",
    is_pinned: false,
    tags: [],
    deleted_at: null,
    revisit_at: null,
    created_at: "2026-08-01T09:00:00Z",
    updated_at: "2026-08-01T09:00:00Z",
    bodyLoaded: false,
    ...partial,
  };
}

describe("dayKey", () => {
  it("uses local calendar parts, not the UTC date", () => {
    // 23:30 local on the 3rd is the 4th in UTC for a positive offset; the key
    // must still say the 3rd or the calendar shifts a column.
    const d = new Date(2026, 7, 3, 23, 30);
    expect(dayKey(d)).toBe("2026-08-03");
  });

  it("zero-pads month and day", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("buildCalendar", () => {
  const today = new Date(2026, 7, 3); // Monday 3 Aug 2026

  it("covers exactly the requested window, Sunday aligned", () => {
    const weeks = buildCalendar(28, { today });
    const days = weeks.flatMap((w) => w.days).filter(Boolean);
    expect(days).toHaveLength(28);
    expect(days[0]!.key).toBe(dayKey(addDays(today, -27)));
    expect(days[days.length - 1]!.key).toBe("2026-08-03");
    // Every column is a full week of seven slots.
    for (const week of weeks) expect(week.days).toHaveLength(7);
  });

  it("pads the leading and trailing slots with null, never with other days", () => {
    const weeks = buildCalendar(10, { today });
    expect(weeks[0].days.slice(0, weeks[0].days.findIndex(Boolean))).toEqual(
      Array(weeks[0].days.findIndex(Boolean)).fill(null)
    );
    const last = weeks[weeks.length - 1].days;
    expect(last[last.length - 1]).toBeNull(); // Mon is index 1, so Tue..Sat are null
  });

  it("attaches moods and marks the day active", () => {
    const weeks = buildCalendar(7, {
      today,
      moods: [{ date_key: "2026-08-02", mood: "Bright", note: "good day" }],
    });
    const day = weeks.flatMap((w) => w.days).find((d) => d?.key === "2026-08-02");
    expect(day?.mood).toBe("Bright");
    expect(day?.moodNote).toBe("good day");
    expect(day?.active).toBe(true);
  });

  it("ignores a mood string that is not one of the six", () => {
    const weeks = buildCalendar(7, {
      today,
      moods: [{ date_key: "2026-08-02", mood: "Elated" }],
    });
    const day = weeks.flatMap((w) => w.days).find((d) => d?.key === "2026-08-02");
    expect(day?.mood).toBeNull();
    expect(day?.active).toBe(true); // still a check-in, just an unknown label
  });

  it("counts quiz rounds and note activity as showing up", () => {
    const weeks = buildCalendar(7, {
      today,
      quizzes: [{ date_key: "2026-08-01", score: 6, attempt: 0 }],
      notes: [note({ created_at: new Date(2026, 6, 31, 10).toISOString(), updated_at: "" })],
    });
    const days = weeks.flatMap((w) => w.days);
    expect(days.find((d) => d?.key === "2026-08-01")?.active).toBe(true);
    expect(days.find((d) => d?.key === "2026-07-31")?.active).toBe(true);
    expect(days.find((d) => d?.key === "2026-07-30")?.active).toBe(false);
  });
});

describe("tallyMoods", () => {
  it("counts, shares and orders by valence", () => {
    const { total, tallies } = tallyMoods([
      { date_key: "1", mood: "Bright" },
      { date_key: "2", mood: "Heavy" },
      { date_key: "3", mood: "Bright" },
      { date_key: "4", mood: "nonsense" },
    ]);
    expect(total).toBe(3);
    expect(tallies.map((t) => t.mood)).toEqual(["Heavy", "Bright"]);
    expect(tallies[1].count).toBe(2);
    expect(tallies[1].share).toBeCloseTo(2 / 3);
  });

  it("is empty, not NaN, with no check-ins", () => {
    expect(tallyMoods([])).toEqual({ total: 0, tallies: [] });
  });
});

describe("longestStreak", () => {
  it("finds the longest consecutive run", () => {
    expect(longestStreak(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-06"])).toBe(3);
  });

  it("ignores duplicates and unsorted input", () => {
    expect(longestStreak(["2026-08-03", "2026-08-01", "2026-08-02", "2026-08-02"])).toBe(3);
  });

  it("counts a single day as one, and nothing as zero", () => {
    expect(longestStreak(["2026-08-01"])).toBe(1);
    expect(longestStreak([])).toBe(0);
  });

  it("does not join days across a month boundary incorrectly", () => {
    expect(longestStreak(["2026-07-31", "2026-08-01"])).toBe(2);
    expect(longestStreak(["2026-07-30", "2026-08-01"])).toBe(1);
  });
});

describe("notesPerWeek", () => {
  const today = new Date(2026, 7, 3); // Monday

  it("buckets by the week's Sunday and keeps empty weeks", () => {
    const bars = notesPerWeek(
      [
        note({ created_at: new Date(2026, 7, 3, 9).toISOString() }),
        note({ created_at: new Date(2026, 7, 2, 9).toISOString() }), // same week (Sun)
        note({ created_at: new Date(2026, 6, 20, 9).toISOString() }),
      ],
      4,
      today
    );
    expect(bars).toHaveLength(4);
    expect(bars[bars.length - 1].count).toBe(2);
    expect(bars.reduce((a, b) => a + b.count, 0)).toBe(3);
  });

  it("drops notes older than the window rather than folding them into week one", () => {
    const bars = notesPerWeek(
      [note({ created_at: new Date(2025, 0, 1).toISOString() })],
      4,
      today
    );
    expect(bars.reduce((a, b) => a + b.count, 0)).toBe(0);
  });
});

describe("topTags / topNotebooks", () => {
  it("ranks tags by count then name", () => {
    const ranked = topTags([
      note({ tags: ["daily", "writing"] }),
      note({ tags: ["daily"] }),
      note({ tags: ["reading"] }),
    ]);
    expect(ranked.map((r) => r.label)).toEqual(["daily", "reading", "writing"]);
    expect(ranked[0].count).toBe(2);
  });

  it("keeps notebook colour and omits empty notebooks", () => {
    const notebooks: Notebook[] = [
      { id: "nb1", user_id: "u1", name: "Inbox", color: "#f59e0b", created_at: "" },
      { id: "nb2", user_id: "u1", name: "Empty", color: "#3b82f6", created_at: "" },
    ];
    const ranked = topNotebooks([note({ notebook_id: "nb1" })], notebooks);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ label: "Inbox", count: 1, color: "#f59e0b" });
  });
});

describe("quizStats", () => {
  it("keeps the best attempt per day and summarises", () => {
    const stats = quizStats([
      { date_key: "2026-08-01", score: 4, attempt: 0 },
      { date_key: "2026-08-01", score: 8, attempt: 1 },
      { date_key: "2026-08-02", score: 6, attempt: 0 },
    ]);
    expect(stats.played).toBe(2);
    expect(stats.best).toBe(8);
    expect(stats.average).toBe(7);
    expect(stats.series.map((s) => s.score)).toEqual([8, 6]);
  });

  it("returns zeros rather than NaN with no rounds", () => {
    expect(quizStats([])).toMatchObject({ played: 0, best: 0, average: 0, series: [] });
  });

  it("limits the series to the most recent days", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      date_key: `2026-07-${`${i + 1}`.padStart(2, "0")}`,
      score: i,
      attempt: 0,
    }));
    const stats = quizStats(rows, 5);
    expect(stats.series).toHaveLength(5);
    expect(stats.series[4].score).toBe(19);
    expect(stats.played).toBe(20);
  });
});
