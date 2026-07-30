import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStreak } from "../hooks/useStreak";
import ReadAloudButton from "../components/ReadAloudButton";
import {
  CATEGORY_META,
  QUESTIONS_PER_DAY,
  dateKey,
  daySeed,
  loadProgress,
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

const TIER_FLOURISH: Record<ReturnType<typeof resultTier>, { emoji: string; label: string }> = {
  perfect: { emoji: "🏆", label: "Perfect score" },
  strong: { emoji: "🌟", label: "Excellent" },
  ok: { emoji: "✨", label: "Nice work" },
  try: { emoji: "💪", label: "Keep going" },
};

export default function Daily() {
  const { streak } = useStreak();
  const key = useMemo(() => dateKey(), []);
  const seed = useMemo(() => daySeed(key), [key]);
  const quote = useMemo(() => pickQuote(seed), [seed]);

  const [{ progress, questions }, setState] = useState(() => bootstrapProgress(key));

  const update = useCallback((next: QuizProgress, nextQuestions?: QuizQuestion[]) => {
    setState((prev) => ({
      progress: next,
      questions: nextQuestions ?? prev.questions,
    }));
    saveProgress(next);
  }, []);

  const current = questions[Math.min(progress.index, Math.max(questions.length - 1, 0))];
  const isCorrect = progress.selected === current?.answer;
  const total = questions.length || QUESTIONS_PER_DAY;
  const meta = current ? CATEGORY_META[current.category] : null;
  const tier = resultTier(progress.score, total);
  const flourish = TIER_FLOURISH[tier];

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
        <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-amber-500/80">
            Streak
          </span>
          <span className="text-sm font-semibold text-amber-400">{streak ?? "–"}</span>
        </div>
      </div>

      <section className="glass mb-4 rounded-3xl p-6">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-400">
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
        <Link
          to="/notes"
          className="mt-4 inline-block text-sm font-medium text-amber-400 hover:text-amber-300"
        >
          Jot a reflection →
        </Link>
      </section>

      <section className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-400">
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
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${chip.tone}`}
                  >
                    <span aria-hidden="true">{chip.emoji}</span>
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
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.tone}`}
            >
              <span className="quiz-category-emoji text-sm" aria-hidden="true">
                {meta.emoji}
              </span>
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
            <div className="quiz-results-badge mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-3xl">
              <span aria-hidden="true">{flourish.emoji}</span>
            </div>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">
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
