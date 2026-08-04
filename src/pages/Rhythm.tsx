import { useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useNotes } from "../context/notes-context";
import { useStreak } from "../hooks/useStreak";
import { RHYTHM_DAYS, useRhythm } from "../hooks/useRhythm";
import {
  MOODS_BY_VALENCE,
  VALENCE_LABEL,
  moodColor,
  valenceVar,
  type MoodValence,
} from "../lib/mood-scale";
import {
  buildCalendar,
  longestStreak,
  notesPerWeek,
  quizStats,
  tallyMoods,
  topNotebooks,
  topTags,
  type RhythmDay,
} from "../lib/rhythm";
import { errorMessage } from "../lib/supabase";
import { buildWeeklyReviewMarkdown } from "../lib/weekly-review";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function Rhythm() {
  const { streak } = useStreak();
  const { notes, notebooks, addNote, inboxId } = useNotes();
  const { moods, quizzes, savedThoughts, loading, error, partial } = useRhythm();

  const [selected, setSelected] = useState<RhythmDay | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const navigate = useNavigate();

  const weeks = useMemo(
    () => buildCalendar(RHYTHM_DAYS, { moods, quizzes, notes }),
    [moods, quizzes, notes]
  );
  const days = useMemo(() => weeks.flatMap((w) => w.days).filter(Boolean) as RhythmDay[], [weeks]);
  const activeKeys = useMemo(() => days.filter((d) => d.active).map((d) => d.key), [days]);

  const { total: moodTotal, tallies } = useMemo(() => tallyMoods(moods), [moods]);
  const quiz = useMemo(() => quizStats(quizzes), [quizzes]);
  const cadence = useMemo(() => notesPerWeek(notes, 12), [notes]);
  const tags = useMemo(() => topTags(notes), [notes]);
  const books = useMemo(() => topNotebooks(notes, notebooks), [notes, notebooks]);
  const longest = useMemo(() => longestStreak(activeKeys), [activeKeys]);

  const notesInWindow = cadence.reduce((a, b) => a + b.count, 0);
  const nothingYet = !loading && moodTotal === 0 && quiz.played === 0 && notes.length === 0;

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
          The last {RHYTHM_DAYS} days of showing up — moods, quizzes and writing.
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
            <Stat label="Days shown up" value={activeKeys.length} unit={`of ${RHYTHM_DAYS}`} />
            <Stat label="Check-ins" value={moodTotal} unit="moods" />
            <Stat label="Notes written" value={notesInWindow} unit="12 weeks" />
            <Stat label="Thoughts saved" value={savedThoughts} unit="all time" />
          </section>

          <MoodCalendar weeks={weeks} selected={selected} onSelect={setSelected} />

          {moodTotal > 0 && (
            <MoodMix
              tallies={tallies}
              total={moodTotal}
              showTable={showTable}
              onToggleTable={() => setShowTable((open) => !open)}
            />
          )}

          <QuizPanel stats={quiz} />

          <CadencePanel bars={cadence} total={notesInWindow} />

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

function MoodCalendar({
  weeks,
  selected,
  onSelect,
}: {
  weeks: ReturnType<typeof buildCalendar>;
  selected: RhythmDay | null;
  onSelect: (day: RhythmDay | null) => void;
}) {
  const detail = selected;

  return (
    <section className="rhythm-panel">
      <PanelTitle>Mood, day by day</PanelTitle>
      <p className="mt-1 text-xs text-muted">
        Every check-in since {weeks[0]?.days.find(Boolean)?.date.toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
        })}
        . Tap a square for that day.
      </p>

      <div className="mt-3 flex gap-2">
        <div
          className="grid shrink-0 gap-[3px] pt-[1.15rem] text-[0.65rem] text-faint"
          style={{ gridTemplateRows: "repeat(7, 0.85rem)" }}
          aria-hidden="true"
        >
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="leading-[0.85rem]">
              {i % 2 === 1 ? d : ""}
            </span>
          ))}
        </div>

        <div className="rhythm-cal min-w-0">
          {weeks.map((week, wi) => (
            <div key={wi}>
              <p className="mb-1 h-4 text-[0.65rem] leading-4 text-faint">{week.monthLabel ?? ""}</p>
              <div className="rhythm-cal__week">
                {week.days.map((day, di) =>
                  day === null ? (
                    <span key={di} className="rhythm-cell rhythm-cell--pad" aria-hidden="true" />
                  ) : (
                    <button
                      key={di}
                      type="button"
                      className="rhythm-cell"
                      data-active={day.active}
                      data-mood={day.mood !== null}
                      data-selected={selected?.key === day.key}
                      style={
                        day.mood
                          ? ({ background: moodColor(day.mood) } as CSSProperties)
                          : undefined
                      }
                      onClick={() => onSelect(selected?.key === day.key ? null : day)}
                      title={`${day.date.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })} — ${day.mood ?? (day.active ? "active, no mood logged" : "nothing logged")}`}
                    >
                      <span className="sr-only">
                        {day.date.toLocaleDateString()} {day.mood ?? "no mood"}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="mt-3 min-h-[2.5rem] text-xs text-ink-soft">
        {detail ? (
          <>
            <span className="font-medium text-ink">
              {detail.date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
            {" — "}
            {detail.mood ?? (detail.active ? "showed up, no mood logged" : "nothing logged")}
            {detail.moodNote && <span className="block text-muted">“{detail.moodNote}”</span>}
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

function QuizPanel({ stats }: { stats: ReturnType<typeof quizStats> }) {
  const max = 10;
  // Label the peak only; a value on every column goes unread.
  const peak = Math.max(...stats.series.map((s) => s.score), 0);
  return (
    <section className="rhythm-panel">
      <PanelTitle>Daily quiz</PanelTitle>
      {stats.played === 0 ? (
        <p className="mt-1 text-xs text-muted">No rounds played yet.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">
            Best score per day · best {stats.best}/{max} · average {stats.average}
          </p>
          <div className="mt-3 flex h-24 items-stretch gap-1">
            {stats.series.map((point) => (
              <div key={point.key} className="rhythm-col" title={`${point.label}: ${point.score}/${max}`}>
                <span
                  className={"rhythm-col__fill" + (point.score === 0 ? " rhythm-col__fill--empty" : "")}
                  style={{ height: `${Math.max((point.score / max) * 100, 3)}%` }}
                >
                  {point.score === peak && (
                    <span className="rhythm-col__value">{point.score}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="rhythm-baseline mt-1" />
          <div className="mt-1 flex justify-between text-[0.65rem] text-faint">
            <span>{stats.series[0]?.label}</span>
            <span>{stats.series[stats.series.length - 1]?.label}</span>
          </div>
        </>
      )}
    </section>
  );
}

function CadencePanel({
  bars,
  total,
}: {
  bars: ReturnType<typeof notesPerWeek>;
  total: number;
}) {
  const max = Math.max(...bars.map((b) => b.count), 1);
  const peakAt = bars.findIndex((b) => b.count === max);
  return (
    <section className="rhythm-panel">
      <PanelTitle>Writing cadence</PanelTitle>
      <p className="mt-1 text-xs text-muted">
        {total} note{total === 1 ? "" : "s"} across 12 weeks · busiest week {max}
      </p>
      <div className="mt-3 flex h-24 items-stretch gap-1">
        {bars.map((bar, i) => (
          <div key={bar.key} className="rhythm-col" title={`Week of ${bar.label}: ${bar.count}`}>
            <span
              className={"rhythm-col__fill" + (bar.count === 0 ? " rhythm-col__fill--empty" : "")}
              style={{ height: `${Math.max((bar.count / max) * 100, 3)}%` }}
            >
              {i === peakAt && <span className="rhythm-col__value">{bar.count}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="rhythm-baseline mt-1" />
      <div className="mt-1 flex justify-between text-[0.65rem] text-faint">
        <span>{bars[0]?.label}</span>
        <span>This week</span>
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

