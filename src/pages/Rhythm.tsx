import { useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import { useStreak } from "../hooks/useStreak";
import { useRhythm } from "../hooks/useRhythm";
import {
  MOODS_BY_VALENCE,
  VALENCE_LABEL,
  moodColor,
  moodInk,
  valenceVar,
  type MoodValence,
} from "../lib/mood-scale";
import { QUESTIONS_PER_DAY } from "../lib/quiz";
import type { Note } from "../lib/types";
import {
  buildCalendar,
  buildMonth,
  historySpan,
  longestStreak,
  quizWindow,
  tallyMoods,
  topNotebooks,
  topTags,
  writingCadence,
  type Cadence,
  type MoodRow,
  type QuizRow,
  type QuizWindow,
  type RhythmDay,
  type WeekdayCount,
} from "../lib/rhythm";
import { errorMessage } from "../lib/supabase";
import { buildWeeklyReviewMarkdown } from "../lib/weekly-review";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Longest quiz strip that still leaves each day a legible slot on a phone. */
const QUIZ_WINDOW = 28;

export default function Rhythm() {
  const { streak } = useStreak();
  const { notes, notebooks, addNote, inboxId } = useNotes();
  const { moods, quizzes, savedThoughts, loading, error, partial } = useRhythm();

  const [selected, setSelected] = useState<RhythmDay | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Only ever claim the history that exists. A three-week-old account should
  // not be shown an 84-day record that is mostly empty squares.
  const span = useMemo(
    () => historySpan({ moods, quizzes, notes }),
    [moods, quizzes, notes]
  );
  const weeks = useMemo(
    () => buildCalendar(span, { moods, quizzes, notes }),
    [span, moods, quizzes, notes]
  );
  const days = useMemo(() => weeks.flatMap((w) => w.days).filter(Boolean) as RhythmDay[], [weeks]);
  const activeKeys = useMemo(() => days.filter((d) => d.active).map((d) => d.key), [days]);

  const { total: moodTotal, tallies } = useMemo(() => tallyMoods(moods), [moods]);
  const quizDays = Math.min(span, QUIZ_WINDOW);
  const quiz = useMemo(() => quizWindow(quizzes, quizDays), [quizzes, quizDays]);
  const cadenceWeeks = Math.max(2, Math.ceil(span / 7));
  const cadence = useMemo(() => writingCadence(notes, cadenceWeeks), [notes, cadenceWeeks]);
  const tags = useMemo(() => topTags(notes), [notes]);
  const books = useMemo(() => topNotebooks(notes, notebooks), [notes, notebooks]);
  const longest = useMemo(() => longestStreak(activeKeys), [activeKeys]);

  const nothingYet = !loading && moodTotal === 0 && quizzes.length === 0 && notes.length === 0;

  const startWeeklyReview = async () => {
    if (reviewBusy) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const { title, content } = buildWeeklyReviewMarkdown({ notes, streak });
      const note = await addNote({
        title,
        content,
        notebook_id: inboxId,
        is_pinned: false,
        tags: ["weekly-review"],
      });
      navigate("/notes/" + note.id + "/edit");
    } catch (err) {
      setReviewError(errorMessage(err));
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="animate-in px-4 pt-6">
      <header className="mb-6">
        <h1 className="page-title text-ink">Rhythm</h1>
        <p className="mt-2 text-sm text-muted">
          {span < 84 ? `Your first ${span} days` : "The last 84 days"} of showing up — moods,
          quizzes and writing.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      )}
      {partial && !error && (
        <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
          Some history could not be read, so a panel below may be empty.
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-3xl bg-surface" />
          ))}
        </div>
      ) : nothingYet ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          <section aria-label="At a glance" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Current streak" value={streak ?? 0} unit={streak === 1 ? "day" : "days"} />
            <Stat label="Longest run" value={longest} unit={longest === 1 ? "day" : "days"} />
            <Stat label="Days shown up" value={activeKeys.length} unit={`of ${span}`} />
            <Stat label="Check-ins" value={moodTotal} unit="moods" />
            <Stat
              label="Notes written"
              value={cadence.total}
              unit={cadenceWeeks === 1 ? "this week" : `${cadenceWeeks} weeks`}
            />
            <Stat label="Thoughts saved" value={savedThoughts} unit="all time" />
          </section>

          <MoodMonth
            moods={moods}
            quizzes={quizzes}
            notes={notes}
            span={span}
            selected={selected}
            onSelect={setSelected}
          />

          {moodTotal > 0 && (
            <MoodMix
              tallies={tallies}
              total={moodTotal}
              showTable={showTable}
              onToggleTable={() => setShowTable((open) => !open)}
            />
          )}

          <QuizPanel data={quiz} rounds={quizzes.length} />

          <CadencePanel data={cadence} weeks={cadenceWeeks} />

          {(tags.length > 0 || books.length > 0) && <RankedPanel tags={tags} books={books} />}

          <section className="rhythm-panel">
            <PanelTitle>Weekly review</PanelTitle>
            <p className="mt-1 text-xs text-muted">
              Turn this week's notes and your streak into a review note you can edit.
            </p>
            {reviewError && <p className="mt-2 text-xs text-danger">{reviewError}</p>}
            <button
              type="button"
              onClick={() => void startWeeklyReview()}
              disabled={reviewBusy}
              className="btn-primary mt-3 w-full rounded-xl px-4 py-2.5 text-sm"
            >
              {reviewBusy ? "Building…" : "Start weekly review"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-ink">{children}</h2>;
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight text-ink">
        {value}
        <span className="ml-1 text-xs font-medium text-muted">{unit}</span>
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rhythm-panel text-center">
      <p className="text-sm font-semibold text-ink">Nothing to look back on yet</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        Rhythm fills in as you use DailyMark — check in with a mood on Daily, play the quiz, or
        write a note. Come back in a few days.
      </p>
      <Link to="/daily" className="mt-3 inline-block text-sm font-medium text-accent-ink">
        Go to Daily →
      </Link>
    </div>
  );
}

function MoodMonth({
  moods,
  quizzes,
  notes,
  span,
  selected,
  onSelect,
}: {
  moods: MoodRow[];
  quizzes: QuizRow[];
  notes: Note[];
  span: number;
  selected: RhythmDay | null;
  onSelect: (day: RhythmDay | null) => void;
}) {
  // Early in a month there is almost nothing to look at, so open on the last
  // complete month instead of three lonely squares — unless the account is too
  // new to have one.
  const [offset, setOffset] = useState(() => {
    const now = new Date();
    return now.getDate() < 8 && span > now.getDate() ? 1 : 0;
  });

  const grid = useMemo(() => {
    const now = new Date();
    const cursor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return buildMonth(cursor.getFullYear(), cursor.getMonth(), { moods, quizzes, notes });
  }, [offset, moods, quizzes, notes]);

  // Never page back past the history there is, or forward past this month.
  const oldest = Math.floor(span / 30);
  const canGoBack = offset < oldest;
  const canGoForward = offset > 0;

  const logged = grid.weeks.flat().filter((d) => d?.mood).length;

  return (
    <section className="rhythm-panel">
      <div className="flex items-center justify-between gap-2">
        <PanelTitle>Mood, day by day</PanelTitle>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            disabled={!canGoBack}
            aria-label="Previous month"
            className="rounded-lg px-2 py-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={!canGoForward}
            aria-label="Next month"
            className="rounded-lg px-2 py-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">
        {grid.label} · {logged} check-in{logged === 1 ? "" : "s"}
      </p>

      <div className="rhythm-month mt-3">
        <div className="rhythm-month__head">
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        {grid.weeks.map((week, wi) => (
          <div key={wi} className="rhythm-month__week">
            {week.map((day, di) =>
              day === null ? (
                <span key={di} className="rhythm-day rhythm-day--pad" aria-hidden="true" />
              ) : (
                <button
                  key={di}
                  type="button"
                  className="rhythm-day"
                  data-active={day.active}
                  data-mood={day.mood !== null}
                  data-selected={selected?.key === day.key}
                  style={
                    day.mood
                      ? ({ background: moodColor(day.mood), color: moodInk(day.mood) } as CSSProperties)
                      : undefined
                  }
                  onClick={() => onSelect(selected?.key === day.key ? null : day)}
                  title={`${day.date.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })} — ${day.mood ?? (day.active ? "showed up, no mood" : "nothing logged")}`}
                >
                  {day.date.getDate()}
                </button>
              )
            )}
          </div>
        ))}
      </div>

      <p aria-live="polite" className="mt-3 min-h-[2.5rem] text-xs text-ink-soft">
        {selected ? (
          <>
            <span className="font-medium text-ink">
              {selected.date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
            {" — "}
            {selected.mood ?? (selected.active ? "showed up, no mood logged" : "nothing logged")}
            {selected.moodNote && <span className="block text-muted">“{selected.moodNote}”</span>}
          </>
        ) : (
          <span className="text-muted">Pick a day to see its check-in.</span>
        )}
      </p>

      <Legend />
    </section>
  );
}

function Legend() {
  const steps: MoodValence[] = [-2, -1, 0, 1, 2];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3">
      <span className="text-xs text-muted">Heavier</span>
      <div className="flex items-center gap-[3px]">
        {steps.map((v) => (
          <span
            key={v}
            className="rhythm-swatch"
            style={{ background: valenceVar(v) } as CSSProperties}
            title={VALENCE_LABEL[v]}
          />
        ))}
      </div>
      <span className="text-xs text-muted">Brighter</span>
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <span className="rhythm-swatch bg-surface-3 ring-1 ring-line-strong" />
        showed up, no mood
      </span>
    </div>
  );
}

function MoodMix({
  tallies,
  total,
  showTable,
  onToggleTable,
}: {
  tallies: ReturnType<typeof tallyMoods>["tallies"];
  total: number;
  showTable: boolean;
  onToggleTable: () => void;
}) {
  return (
    <section className="rhythm-panel">
      <PanelTitle>How the days felt</PanelTitle>
      <p className="mt-1 text-xs text-muted">
        {total} check-in{total === 1 ? "" : "s"}, heaviest to brightest.
      </p>

      <div className="mt-3 rhythm-diverge" role="img" aria-label="Mood distribution">
        {tallies.map((t) => (
          <span
            key={t.mood}
            className="rhythm-diverge__seg"
            style={
              { background: moodColor(t.mood), flexGrow: t.count, flexBasis: 0 } as CSSProperties
            }
            title={`${t.mood}: ${t.count}`}
          />
        ))}
      </div>

      {/* Legend, always present: identity never rests on colour alone. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {tallies.map((t) => (
          <li key={t.mood} className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span
              className="rhythm-swatch"
              style={{ background: moodColor(t.mood) } as CSSProperties}
            />
            {t.mood}
            <span className="text-muted">{Math.round(t.share * 100)}%</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onToggleTable}
        aria-expanded={showTable}
        className="mt-3 text-xs font-medium text-accent-ink"
      >
        {showTable ? "Hide numbers" : "Show numbers"}
      </button>

      {showTable && (
        <table className="rhythm-table mt-2">
          <thead>
            <tr>
              <th scope="col">Mood</th>
              <th scope="col">Days</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {MOODS_BY_VALENCE.map((mood) => {
              const row = tallies.find((t) => t.mood === mood);
              return (
                <tr key={mood}>
                  <td>{mood}</td>
                  <td>{row?.count ?? 0}</td>
                  <td>{Math.round((row?.share ?? 0) * 100)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** A rule and the tick that names it, both placed from the same percentage. */
function PlotRule({ at, kind = "grid" }: { at: number; kind?: "grid" | "mean" }) {
  return (
    <span
      aria-hidden="true"
      className={"rhythm-plot__rule" + (kind === "mean" ? " rhythm-plot__rule--mean" : "")}
      style={{ bottom: `${at}%` }}
    />
  );
}

function PlotTick({ at, children }: { at: number; children: React.ReactNode }) {
  return (
    <span className="rhythm-plot__tick" style={{ bottom: `${at}%` }}>
      {children}
    </span>
  );
}

/**
 * One slot per calendar day, played or not.
 *
 * The old chart plotted only the days that had a round, which quietly closed
 * its own gaps: two rounds a fortnight apart sat side by side reading as
 * consecutive. Days are slots on a real axis now, and each slot's track runs
 * the full height of the scale — the empty part of a column is the headroom
 * left to a perfect round, and a day with no round is that track on its own.
 */
function QuizPanel({ data, rounds }: { data: QuizWindow; rounds: number }) {
  const [showTable, setShowTable] = useState(false);
  const max = QUESTIONS_PER_DAY;
  const first = data.days[0];
  const today = data.days[data.days.length - 1];

  if (rounds === 0 || data.played === 0) {
    return (
      <section className="rhythm-panel">
        <PanelTitle>Daily quiz</PanelTitle>
        <p className="mt-1 text-xs text-muted">
          {rounds === 0 ? "No rounds played yet." : `No rounds in the last ${data.span} days.`}
        </p>
      </section>
    );
  }

  return (
    <section className="rhythm-panel">
      <PanelTitle>Daily quiz</PanelTitle>
      <p className="mt-1 text-xs text-muted">
        Best score each day · played {data.played} of {data.span} · best {data.best}/{max}
      </p>

      <figure className="rhythm-plot mt-3">
        <div className="rhythm-plot__scale" aria-hidden="true">
          <PlotTick at={100}>{max}</PlotTick>
          <PlotTick at={50}>{max / 2}</PlotTick>
        </div>

        <div className="rhythm-plot__area">
          <PlotRule at={100} />
          <PlotRule at={50} />
          <PlotRule at={(data.average / max) * 100} kind="mean" />
          <div
            className="rhythm-days"
            role="img"
            aria-label={`Best quiz score for each of the last ${data.span} days: played on ${data.played} of them, best ${data.best} out of ${max}, average ${data.average}.`}
          >
            {data.days.map((day) => (
              <span
                key={day.key}
                className="rhythm-days__slot"
                data-today={day.key === today?.key}
                title={`${day.label} — ${day.score === null ? "no round" : `${day.score}/${max}`}`}
              >
                {day.score !== null && (
                  <span
                    className="rhythm-days__bar"
                    style={{ height: `${Math.max((day.score / max) * 100, 2)}%` }}
                  />
                )}
              </span>
            ))}
          </div>
        </div>

        <figcaption className="rhythm-plot__foot">
          <span>{first?.label}</span>
          <span>{today?.label}</span>
        </figcaption>
      </figure>

      <div className="rhythm-legend">
        <span>
          <span className="rhythm-legend__mean" aria-hidden="true" />
          average {data.average}
        </span>
        <span>
          <span className="rhythm-legend__track" aria-hidden="true" />
          no round
        </span>
      </div>

      <button
        type="button"
        onClick={() => setShowTable((open) => !open)}
        aria-expanded={showTable}
        className="mt-3 text-xs font-medium text-accent-ink"
      >
        {showTable ? "Hide numbers" : "Show numbers"}
      </button>

      {showTable && (
        <table className="rhythm-table mt-2">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {[...data.days]
              .reverse()
              .filter((day) => day.score !== null)
              .map((day) => (
                <tr key={day.key}>
                  <td>{day.label}</td>
                  <td>
                    {day.score}/{max}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** "Thu and Fri", or null when there is no winner worth naming. */
function joinLabels(days: WeekdayCount[]): string | null {
  if (days.length === 0 || days.length > 3) return null;
  return new Intl.ListFormat(undefined, { style: "short", type: "conjunction" }).format(
    days.map((d) => d.label)
  );
}

/**
 * A trend line for the weekly totals, and the weekday breakdown answering the
 * more useful question of *when* the writing happens.
 *
 * Both halves come from one `writingCadence()` call, because they used to
 * disagree — the bars counted every note the account had while the headline
 * above them counted only the window. Every number now sits where its data is:
 * the peak and the latest week label their own dots instead of being narrated
 * in a line of text under the middle of the chart.
 */
function CadencePanel({ data, weeks }: { data: Cadence; weeks: number }) {
  const bars = data.weeks;
  const max = Math.max(...bars.map((b) => b.count), 1);
  // The top 16% of the plot is left clear for the dot labels to sit in.
  const pct = (count: number) => (count / max) * 84;
  const x = (i: number) => (bars.length > 1 ? (i / (bars.length - 1)) * 100 : 50);
  const line = bars.map((b, i) => `${x(i)},${100 - pct(b.count)}`).join(" ");
  const peaks = new Set(data.peak.map((p) => p.key));
  const busiest = new Set(data.busiest.map((d) => d.weekday));
  const weekdayMax = Math.max(...data.weekdays.map((d) => d.count), 1);
  const first = bars[0];
  const last = bars[bars.length - 1];
  const mostOn = joinLabels(data.busiest);

  if (data.total === 0) {
    return (
      <section className="rhythm-panel">
        <PanelTitle>Writing cadence</PanelTitle>
        <p className="mt-1 text-xs text-muted">
          No notes in the last {weeks} weeks. Write one and the trend starts here.
        </p>
      </section>
    );
  }

  return (
    <section className="rhythm-panel">
      <PanelTitle>Writing cadence</PanelTitle>
      <p className="mt-1 text-xs text-muted">
        {data.total} note{data.total === 1 ? "" : "s"} over {weeks} week
        {weeks === 1 ? "" : "s"} · {data.perWeek} a week on average
      </p>

      <figure className="rhythm-plot mt-3">
        <div className="rhythm-plot__scale" aria-hidden="true">
          <PlotTick at={pct(max)}>{max}</PlotTick>
          <PlotTick at={0}>0</PlotTick>
        </div>

        <div className="rhythm-plot__area">
          <PlotRule at={pct(max)} />
          <PlotRule at={pct(data.perWeek)} kind="mean" />
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="rhythm-trend"
            role="img"
            aria-label={`Notes written each week, ${data.total} in total, peaking at ${max} and finishing at ${last?.count ?? 0}.`}
          >
            <polygon points={`0,100 ${line} 100,100`} className="rhythm-trend__area" />
            <polyline points={line} className="rhythm-trend__line" />
          </svg>
          {/* The dots are HTML over the SVG, not <circle>s in it: the plot
              stretches to whatever width the panel has, and a circle under a
              non-uniform scale comes out an ellipse. */}
          {bars.map((bar, i) => {
            const isPeak = peaks.has(bar.key);
            const label = isPeak
              ? bar.key === data.peak[0]?.key
              : bar.key === last?.key;
            return (
              <span
                key={bar.key}
                className={"rhythm-dot" + (isPeak ? " rhythm-dot--peak" : "")}
                style={{ left: `${x(i)}%`, bottom: `${pct(bar.count)}%` }}
                title={`Week of ${bar.label} — ${bar.count} note${bar.count === 1 ? "" : "s"}`}
              >
                {label && (
                  <span
                    className={
                      "rhythm-dot__value" + (isPeak ? "" : " rhythm-dot__value--quiet")
                    }
                  >
                    {bar.count}
                  </span>
                )}
              </span>
            );
          })}
        </div>

        <figcaption className="rhythm-plot__foot">
          <span>Week of {first?.label}</span>
          <span>This week</span>
        </figcaption>
      </figure>

      <div className="rhythm-legend">
        <span>
          <span className="rhythm-legend__mean" aria-hidden="true" />
          average {data.perWeek} a week
        </span>
        <span>
          <span className="rhythm-legend__dot" aria-hidden="true" />
          busiest week
        </span>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          When you write{mostOn ? ` · most on ${mostOn}` : ""}
        </p>
        {/* Every bar grows inside a track of the same height, so the counts sit
            on one straight row. Hung above bars of different heights they
            zig-zagged, and a weekday with none of them had its 0 stranded at
            the bottom of the panel. */}
        <div className="rhythm-weekdays mt-2">
          {data.weekdays.map((day) => (
            <div key={day.weekday} className="rhythm-weekdays__col">
              <span
                className="rhythm-weekdays__track"
                title={`${day.label} — ${day.count} note${day.count === 1 ? "" : "s"}`}
              >
                <span
                  className={
                    "rhythm-weekdays__bar" +
                    (busiest.has(day.weekday) ? " rhythm-weekdays__bar--top" : "")
                  }
                  style={{ height: `${(day.count / weekdayMax) * 100}%` }}
                />
              </span>
              <span className="text-xs text-muted">{day.label[0]}</span>
              <span className="text-xs font-medium text-ink-soft">{day.count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RankedPanel({
  tags,
  books,
}: {
  tags: ReturnType<typeof topTags>;
  books: ReturnType<typeof topNotebooks>;
}) {
  return (
    <section className="rhythm-panel">
      <PanelTitle>What you write about</PanelTitle>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {books.length > 0 && <RankedList heading="Notebooks" rows={books} />}
        {tags.length > 0 && <RankedList heading="Tags" rows={tags} />}
      </div>
    </section>
  );
}

function RankedList({
  heading,
  rows,
}: {
  heading: string;
  rows: ReturnType<typeof topTags>;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">{heading}</p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 text-ink-soft">
                {row.color && (
                  <span
                    className="rhythm-swatch"
                    style={{ background: row.color } as CSSProperties}
                  />
                )}
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 text-muted">{row.count}</span>
            </div>
            <div className="rhythm-bar__track mt-1">
              <span
                className="rhythm-bar block"
                style={{ width: `${Math.max((row.count / max) * 100, 4)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

