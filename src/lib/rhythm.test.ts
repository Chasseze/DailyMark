import { describe, expect, it } from "vitest";
import {
  addDays,
  buildCalendar,
  buildMonth,
  dayKey,
  historySpan,
  notesPerWeekday,
  longestStreak,
  notesPerWeek,
  quizWindow,
  tallyMoods,
  topNotebooks,
  topTags,
  writingCadence,
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

describe("quizWindow", () => {
  const today = new Date(2026, 7, 3); // Monday 3 Aug 2026

  it("keeps the best attempt of a day and summarises the window", () => {
    const stats = quizWindow(
      [
        { date_key: "2026-08-01", score: 4, attempt: 0 },
        { date_key: "2026-08-01", score: 8, attempt: 1 },
        { date_key: "2026-08-02", score: 6, attempt: 0 },
      ],
      7,
      today
    );
    expect(stats.played).toBe(2);
    expect(stats.best).toBe(8);
    expect(stats.average).toBe(7);
  });

  it("covers every calendar day in the window, ending today", () => {
    const stats = quizWindow([], 14, today);
    expect(stats.days).toHaveLength(14);
    expect(stats.span).toBe(14);
    expect(stats.days[0].key).toBe(dayKey(addDays(today, -13)));
    expect(stats.days[13].key).toBe("2026-08-03");
  });

  it("holds a day with no round as null, not as a zero", () => {
    const stats = quizWindow(
      [
        { date_key: "2026-08-01", score: 7, attempt: 0 },
        { date_key: "2026-08-03", score: 0, attempt: 0 },
      ],
      4,
      today
    );
    expect(stats.days.map((d) => d.score)).toEqual([null, 7, null, 0]);
    // The nil round counts as played and drags the average; the gaps do not.
    expect(stats.played).toBe(2);
    expect(stats.average).toBe(3.5);
  });

  it("ignores rounds older than the window rather than folding them in", () => {
    const stats = quizWindow([{ date_key: "2026-06-01", score: 9, attempt: 0 }], 7, today);
    expect(stats.played).toBe(0);
    expect(stats.best).toBe(0);
    expect(stats.days.every((d) => d.score === null)).toBe(true);
  });

  it("returns zeros rather than NaN with no rounds at all", () => {
    expect(quizWindow([], 7, today)).toMatchObject({ played: 0, best: 0, average: 0 });
  });
});

describe("historySpan", () => {
  const today = new Date(2026, 7, 3);

  it("falls back to the minimum for a brand-new account", () => {
    expect(historySpan({ today })).toBe(28);
  });

  it("clamps up: a week-old account still gets a month of grid", () => {
    const span = historySpan({ today, moods: [{ date_key: "2026-07-30", mood: "Calm" }] });
    expect(span).toBe(28);
  });

  it("reports the real span once there is more than the minimum", () => {
    const span = historySpan({ today, moods: [{ date_key: "2026-06-04", mood: "Calm" }] });
    expect(span).toBe(61); // 4 Jun → 3 Aug inclusive
  });

  it("clamps down at the maximum", () => {
    const span = historySpan({ today, moods: [{ date_key: "2024-01-01", mood: "Calm" }] });
    expect(span).toBe(84);
  });

  it("takes the earliest across all three sources", () => {
    const span = historySpan({
      today,
      moods: [{ date_key: "2026-07-30", mood: "Calm" }],
      quizzes: [{ date_key: "2026-07-01", score: 5, attempt: 0 }],
      notes: [note({ created_at: new Date(2026, 5, 10).toISOString() })],
    });
    expect(span).toBe(55); // 10 Jun is earliest
  });
});

describe("buildMonth", () => {
  const today = new Date(2026, 7, 3); // Mon 3 Aug 2026

  it("lays August 2026 out as calendar weeks", () => {
    const grid = buildMonth(2026, 7, { today });
    expect(grid.label).toContain("August");
    // 1 Aug 2026 is a Saturday, so the first row is six nulls then the 1st.
    expect(grid.weeks[0].slice(0, 6).every((d) => d === null)).toBe(true);
    expect(grid.weeks[0][6]?.date.getDate()).toBe(1);
    for (const week of grid.weeks) expect(week).toHaveLength(7);
  });

  it("does not render days in the future", () => {
    const grid = buildMonth(2026, 7, { today });
    const real = grid.weeks.flat().filter(Boolean);
    expect(real).toHaveLength(3); // 1, 2, 3 August
    expect(real[real.length - 1]!.key).toBe("2026-08-03");
  });

  it("renders a fully past month end to end", () => {
    const grid = buildMonth(2026, 6, { today }); // July
    expect(grid.weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("carries mood, note and activity onto the right day", () => {
    const grid = buildMonth(2026, 6, {
      today,
      moods: [{ date_key: "2026-07-15", mood: "Bright", note: "shipped it" }],
      quizzes: [{ date_key: "2026-07-16", score: 7, attempt: 0 }],
    });
    const days = grid.weeks.flat().filter(Boolean);
    const fifteenth = days.find((d) => d!.key === "2026-07-15")!;
    expect(fifteenth.mood).toBe("Bright");
    expect(fifteenth.moodNote).toBe("shipped it");
    expect(days.find((d) => d!.key === "2026-07-16")!.active).toBe(true);
    expect(days.find((d) => d!.key === "2026-07-17")!.active).toBe(false);
  });
});

describe("notesPerWeekday", () => {
  it("always returns seven buckets, Sunday first", () => {
    const rows = notesPerWeekday([]);
    expect(rows).toHaveLength(7);
    expect(rows[0].label).toBe("Sun");
    expect(rows.every((r) => r.count === 0)).toBe(true);
  });

  it("counts notes onto their local weekday", () => {
    const rows = notesPerWeekday([
      note({ created_at: new Date(2026, 7, 3, 9).toISOString() }), // Monday
      note({ created_at: new Date(2026, 7, 10, 9).toISOString() }), // Monday
      note({ created_at: new Date(2026, 7, 4, 9).toISOString() }), // Tuesday
    ]);
    expect(rows[1].count).toBe(2);
    expect(rows[2].count).toBe(1);
  });
});

describe("writingCadence", () => {
  const today = new Date(2026, 7, 3); // Monday 3 Aug 2026

  it("gives the weekday bars the same window as the weekly totals", () => {
    // Two notes inside a two-week window, one long before it. The weekday bars
    // used to count all three while the headline counted two, so the bars added
    // up to more than the total printed above them.
    const cadence = writingCadence(
      [
        note({ created_at: new Date(2026, 7, 3, 9).toISOString() }), // this Mon
        note({ created_at: new Date(2026, 6, 28, 9).toISOString() }), // last Tue
        note({ created_at: new Date(2026, 4, 4, 9).toISOString() }), // May, outside
      ],
      2,
      today
    );
    expect(cadence.total).toBe(2);
    expect(cadence.weekdays.reduce((a, d) => a + d.count, 0)).toBe(cadence.total);
    expect(cadence.weekdays[1].count).toBe(1); // Monday
    expect(cadence.weekdays[2].count).toBe(1); // Tuesday
  });

  it("reports the peak week and busiest weekday", () => {
    const cadence = writingCadence(
      [
        note({ created_at: new Date(2026, 7, 3, 9).toISOString() }),
        note({ created_at: new Date(2026, 6, 28, 9).toISOString() }),
        note({ created_at: new Date(2026, 6, 28, 14).toISOString() }),
      ],
      2,
      today
    );
    expect(cadence.peak).toHaveLength(1);
    expect(cadence.peak[0].count).toBe(2);
    expect(cadence.peak[0].key).toBe("2026-07-26"); // the Sunday of that week
    expect(cadence.busiest.map((d) => d.label)).toEqual(["Tue"]);
    expect(cadence.perWeek).toBe(1.5);
  });

  it("keeps every tie rather than singling one out", () => {
    const cadence = writingCadence(
      [
        note({ created_at: new Date(2026, 7, 3, 9).toISOString() }), // Monday
        note({ created_at: new Date(2026, 6, 28, 9).toISOString() }), // Tuesday
      ],
      2,
      today
    );
    expect(cadence.peak).toHaveLength(2);
    expect(cadence.busiest.map((d) => d.label)).toEqual(["Mon", "Tue"]);
  });

  it("claims no peak and no busiest day when nothing was written", () => {
    const cadence = writingCadence([], 4, today);
    expect(cadence.total).toBe(0);
    expect(cadence.perWeek).toBe(0);
    expect(cadence.peak).toEqual([]);
    expect(cadence.busiest).toEqual([]);
    expect(cadence.weeks).toHaveLength(4);
    expect(cadence.weekdays).toHaveLength(7);
  });
});
