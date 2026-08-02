import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStreak } from "../hooks/useStreak";
import { useAuth } from "../context/auth-context";
import { useNotes } from "../context/notes-context";
import { useThoughts } from "../context/thoughts-context";
import ReadAloudButton from "../components/ReadAloudButton";
import { errorMessage, requireSupabase } from "../lib/supabase";
import { buildWeeklyReviewMarkdown } from "../lib/weekly-review";
import {
  CATEGORY_META,
  QUESTIONS_PER_DAY,
  dateKey,
  daySeed,
  loadProgress,
  loadProgressSynced,
  pickQuestions,
  resolveQuestions,
  resultMessage,
  resultTier,
  saveProgress,
  type QuizProgress,
  type QuizQuestion,
} from "../lib/quiz";

interface Quote {
  text: string;
  source: string;
}

const QUOTES: Quote[] = [
  { text: "The only way to do great work is to love what you do.", source: "Steve Jobs" },
  { text: "Simplicity is the ultimate sophistication.", source: "Leonardo da Vinci" },
  { text: "Stay hungry, stay foolish.", source: "Steve Jobs" },
  { text: "The journey of a thousand miles begins with a single step.", source: "Lao Tzu" },
  { text: "What we know is a drop, what we don't know is an ocean.", source: "Isaac Newton" },
  { text: "In the middle of difficulty lies opportunity.", source: "Albert Einstein" },
  { text: "Done is better than perfect.", source: "Sheryl Sandberg" },
];

const MOODS = ["Calm", "Focused", "Tired", "Heavy", "Bright", "Unsure"] as const;
type DailyMood = (typeof MOODS)[number];

function isDailyMood(value: string): value is DailyMood {
  return (MOODS as readonly string[]).includes(value);
}

function pickQuote(seed: number) {
  return QUOTES[seed % QUOTES.length];
}

function freshProgress(key: string, attempt: number, questions: QuizQuestion[]): QuizProgress {
  return {
    dateKey: key,
    attempt,
    questionIds: questions.map((q) => q.id),
    index: 0,
    score: 0,
    selected: null,
    phase: "ready",
  };
}

function bootstrapProgress(key: string): { progress: QuizProgress; questions: QuizQuestion[] } {
  const saved = loadProgress(key);
  if (saved) {
    const resolved = resolveQuestions(saved.questionIds);
    if (resolved) return { progress: saved, questions: resolved };
  }
  const questions = pickQuestions(key, 0);
  return { progress: freshProgress(key, 0, questions), questions };
}

const TIER_FLOURISH: Record<ReturnType<typeof resultTier>, { label: string }> = {
  perfect: { label: "Perfect score" },
  strong: { label: "Excellent" },
  ok: { label: "Nice work" },
  try: { label: "Keep going" },
};

export default function Daily() {
  const { streak } = useStreak();
  const { user } = useAuth();
  const { addNote, notes, inboxId, dueNotes } = useNotes();
  const { pinned } = useThoughts();
  const navigate = useNavigate();
  const key = useMemo(() => dateKey(), []);
  const seed = useMemo(() => daySeed(key), [key]);
  const quote = useMemo(() => pickQuote(seed), [seed]);
  const [jotBusy, setJotBusy] = useState(false);
  const [jotError, setJotError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<DailyMood | null>(null);
  const [moodBusy, setMoodBusy] = useState(false);

  const [{ progress, questions }, setState] = useState(() => bootstrapProgress(key));

  // Prefer cloud progress once the session is ready (localStorage is the cache).
  useEffect(() => {
    let active = true;
    void loadProgressSynced(key).then((remote) => {
      if (!active || !remote) return;
      const resolved = resolveQuestions(remote.questionIds);
      if (!resolved) return;
      setState({ progress: remote, questions: resolved });
    });
    return () => {
      active = false;
    };
  }, [key]);

  // Load today's mood check-in from Supabase.
  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      try {
        const db = requireSupabase();
        const { data, error } = await db
          .from("daily_moods")
          .select("mood")
          .eq("user_id", user.id)
          .eq("date_key", key)
          .maybeSingle();
        if (!active || error || !data?.mood) return;
        if (isDailyMood(data.mood)) setSelectedMood(data.mood);
      } catch {
        // offline / missing table — mood UI still works locally
      }
    })();
    return () => {
      active = false;
    };
  }, [user, key]);

  const update = useCallback((next: QuizProgress, nextQuestions?: QuizQuestion[]) => {
    setState((prev) => ({
      progress: next,
      questions: nextQuestions ?? prev.questions,
    }));
    saveProgress(next);
  }, []);

  const selectMood = async (mood: DailyMood) => {
    if (!user || moodBusy) return;
    setSelectedMood(mood);
    setMoodBusy(true);
    try {
      const db = requireSupabase();
      const { error } = await db.from("daily_moods").upsert({
        user_id: user.id,
        date_key: key,
        mood,
      });
      if (error) throw error;
    } catch {
      // Keep the optimistic selection; retry on next tap.
    } finally {
      setMoodBusy(false);
    }
  };

  const jotReflection = async () => {
    if (jotBusy) return;
    setJotBusy(true);
    setJotError(null);
    try {
      const note = await addNote({
        title: `Reflection · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
        content: `> ${quote.text}\n>\n> — ${quote.source}\n\n`,
        notebook_id: null,
        is_pinned: false,
        tags: ["daily"],
      });
      navigate("/notes/" + note.id + "/edit");
    } catch (err) {
      setJotError(errorMessage(err));
    } finally {
      setJotBusy(false);
    }
  };

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

  const current = questions[Math.min(progress.index, Math.max(questions.length - 1, 0))];
  const isCorrect = progress.selected === current?.answer;
  const total = questions.length || QUESTIONS_PER_DAY;
  const meta = current ? CATEGORY_META[current.category] : null;
  const tier = resultTier(progress.score, total);
  const flourish = TIER_FLOURISH[tier];
  const revisitPreview = dueNotes.slice(0, 3);

  // Remount the question card when the prompt changes so the enter animation
  // plays — leave the phase out of the key so feedback does not re-animate options.
  const questionKey = `${progress.attempt}-${progress.index}`;

  const startQuiz = () => {
    update({
      ...progress,
      index: 0,
      score: 0,
      selected: null,
      phase: "question",
    });
  };

  const choose = (opt: string) => {
    if (progress.phase !== "question" || progress.selected || !current) return;
    const correct = opt === current.answer;
    update({
      ...progress,
      selected: opt,
      score: progress.score + (correct ? 1 : 0),
      phase: "feedback",
    });
  };

  const goNext = () => {
    const nextIndex = progress.index + 1;
    if (nextIndex >= total) {
      update({ ...progress, phase: "results", selected: null });
      return;
    }
    update({
      ...progress,
      index: nextIndex,
      selected: null,
      phase: "question",
    });
  };

  /** A new attempt draws a different mix from the bank for the same calendar day. */
  const playAgain = () => {
    const attempt = progress.attempt + 1;
    const nextQuestions = pickQuestions(key, attempt);
    update(
      {
        dateKey: key,
        attempt,
        questionIds: nextQuestions.map((q) => q.id),
        index: 0,
        score: 0,
        selected: null,
        phase: "question",
      },
      nextQuestions
    );
  };

  const categoriesInRound = useMemo(() => {
    const seen = new Set<string>();
    const list: QuizQuestion["category"][] = [];
    for (const question of questions) {
      if (!seen.has(question.category)) {
        seen.add(question.category);
        list.push(question.category);
      }
    }
    return list;
  }, [questions]);

  return (
    <div className="animate-in px-4 pt-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title text-white light:text-slate-900">Daily spark</h1>
          <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-500/80">
            Streak
          </span>
          <span className="text-sm font-semibold text-amber-400">{streak ?? "–"}</span>
        </div>
      </div>

      <section className="mb-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          How are you feeling?
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MOODS.map((mood) => {
            const active = selectedMood === mood;
            return (
              <button
                key={mood}
                type="button"
                onClick={() => void selectMood(mood)}
                disabled={moodBusy}
                className={
                  "rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50 " +
                  (active
                    ? "bg-amber-500/15 font-medium text-amber-400"
                    : "bg-white/5 text-slate-400 hover:bg-white/8 hover:text-slate-200 light:bg-slate-100 light:text-slate-600 light:hover:bg-slate-200/80 light:hover:text-slate-800")
                }
              >
                {mood}
              </button>
            );
          })}
        </div>
      </section>

      {pinned && (
        <Link
          to={"/thoughts/" + pinned.id}
          className="glass mb-4 block rounded-2xl p-4 transition-colors hover:bg-white/[0.04] light:hover:bg-slate-50"
        >
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-400/90">
            Thought of the week
          </span>
          <p className="note-title mt-2 text-base leading-snug text-white light:text-slate-900">
            {pinned.title}
          </p>
          <span className="mt-2 inline-block text-sm font-medium text-amber-400">Open →</span>
        </Link>
      )}

      {revisitPreview.length > 0 && (
        <section className="mb-4 rounded-2xl border border-white/5 bg-slate-900/30 px-4 py-3 light:border-slate-200 light:bg-slate-50/80">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Revisit
            </span>
            {dueNotes.length > 3 && (
              <span className="text-[11px] text-slate-500">+{dueNotes.length - 3} more</span>
            )}
          </div>
          <ul className="mt-2 space-y-1.5">
            {revisitPreview.map((note) => (
              <li key={note.id}>
                <Link
                  to={"/notes/" + note.id}
                  className="block truncate text-sm text-slate-300 transition-colors hover:text-amber-400 light:text-slate-700 light:hover:text-amber-600"
                >
                  {note.title.trim() || "Untitled"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="glass mb-4 rounded-3xl p-6">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-block rounded-lg bg-amber-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-400">
            Quote of the day
          </span>
          <ReadAloudButton
            compact
            request={{
              id: "daily-quote",
              label: "Quote of the day",
              text: `${quote.text} — ${quote.source}`,
              markdown: false,
            }}
          />
        </div>
        <p className="note-title mt-4 text-xl leading-snug text-white light:text-slate-900">
          {quote.text}
        </p>
        <p className="mt-3 text-sm text-slate-400">— {quote.source}</p>
        <button
          type="button"
          onClick={() => void jotReflection()}
          disabled={jotBusy}
          className="mt-4 inline-block text-sm font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50"
        >
          {jotBusy ? "Opening note…" : "Jot a reflection →"}
        </button>
        {jotError && <p className="mt-2 text-xs text-red-400">{jotError}</p>}
        <div className="mt-4 border-t border-white/5 pt-4 light:border-slate-200">
          <button
            type="button"
            onClick={() => void startWeeklyReview()}
            disabled={reviewBusy}
            className="text-sm font-medium text-slate-300 transition-colors hover:text-amber-400 disabled:opacity-50 light:text-slate-600 light:hover:text-amber-600"
          >
            {reviewBusy ? "Opening weekly review…" : "Start weekly review →"}
          </button>
          {reviewError && <p className="mt-2 text-xs text-red-400">{reviewError}</p>}
        </div>
      </section>

      <section className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-block rounded-lg bg-amber-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-400">
            Daily quiz
          </span>
          {progress.phase !== "ready" && progress.phase !== "results" && (
            <span className="text-xs text-slate-500">
              {progress.index + 1} / {total}
            </span>
          )}
          {progress.attempt > 0 && progress.phase === "ready" && (
            <span className="text-[11px] text-slate-500">Round {progress.attempt + 1}</span>
          )}
        </div>

        {progress.phase !== "ready" && progress.phase !== "results" && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800/60 light:bg-slate-200">
            <div
              className="quiz-progress-fill h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
              style={{
                width: `${((progress.index + (progress.phase === "feedback" ? 1 : 0)) / total) * 100}%`,
              }}
            />
          </div>
        )}

        {progress.phase === "ready" && (
          <div className="quiz-panel mt-4">
            <p className="note-title text-xl text-white light:text-slate-900">
              {total} questions · mixed categories
            </p>
            <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
              Medicine, science, current affairs, general knowledge and more. Finish for a score —
              play again and the set rotates.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {categoriesInRound.map((category) => {
                const chip = CATEGORY_META[category];
                return (
                  <span
                    key={category}
                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-medium ${chip.tone}`}
                  >
                    {chip.label}
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              onClick={startQuiz}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Start today's quiz
            </button>
          </div>
        )}

        {(progress.phase === "question" || progress.phase === "feedback") && current && meta && (
          <div key={questionKey} className="quiz-panel mt-4">
            <div
              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-medium ${meta.tone}`}
            >
              {meta.label}
            </div>
            <p className="note-title mt-3 text-lg leading-snug text-white light:text-slate-900">
              {current.text}
            </p>

            <div className="mt-5 space-y-2">
              {current.options.map((opt, optionIndex) => {
                let cls =
                  "quiz-option w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ";
                if (progress.phase === "question") {
                  cls +=
                    "border-white/5 bg-slate-800/30 text-slate-300 hover:border-amber-500/30 hover:bg-slate-800/50 light:border-slate-200 light:bg-slate-50 light:text-slate-700";
                } else if (opt === current.answer) {
                  cls += "quiz-option-correct border-green-500/30 bg-green-500/10 text-green-400";
                } else if (opt === progress.selected) {
                  cls += "quiz-option-wrong border-red-500/30 bg-red-500/10 text-red-400";
                } else {
                  cls +=
                    "border-white/5 bg-slate-800/20 text-slate-600 light:border-slate-200 light:bg-slate-50";
                }
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => choose(opt)}
                    disabled={progress.phase !== "question"}
                    style={{ animationDelay: `${optionIndex * 40}ms` }}
                    className={cls}
                  >
                    <span className="mr-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/5 text-[10px] font-semibold text-slate-500 light:bg-slate-200/80">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {progress.phase === "feedback" && (
              <div className="quiz-feedback mt-4 space-y-3">
                <div
                  className={
                    "rounded-xl p-3 text-sm " +
                    (isCorrect
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400")
                  }
                >
                  <p className="font-medium">
                    {isCorrect ? (
                      <>
                        <span aria-hidden="true">✓ </span>Correct.
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">✗ </span>Not quite — answer: {current.answer}
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs opacity-90">{current.explain}</p>
                </div>
                <button
                  type="button"
                  onClick={goNext}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {progress.index + 1 >= total ? "See results" : "Next question"}
                </button>
              </div>
            )}
          </div>
        )}

        {progress.phase === "results" && (
          <div className="quiz-results mt-4 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {flourish.label}
              {progress.attempt > 0 ? ` · round ${progress.attempt + 1}` : ""}
            </p>
            <p className="note-title mt-2 text-3xl text-white light:text-slate-900">
              <span className="quiz-score-pop">{progress.score}</span>
              <span className="text-slate-500"> / {total}</span>
            </p>
            <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
              {resultMessage(progress.score, total)}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={playAgain}
                className="flex-1 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800/60 light:border-slate-200 light:bg-white light:text-slate-700"
              >
                Play again · new questions
              </button>
              <Link
                to="/notes"
                className="flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-black"
              >
                Back to notes
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
