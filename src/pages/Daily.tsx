import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStreak } from "../hooks/useStreak";
import ReadAloudButton from "../components/ReadAloudButton";

interface Quote {
  text: string;
  source: string;
}

interface QuizQuestion {
  id: string;
  text: string;
  topic: string;
  options: string[];
  answer: string;
  explain: string;
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

const QUIZ_BANK: QuizQuestion[] = [
  {
    id: "q1",
    text: "Which philosopher said 'I think, therefore I am'?",
    topic: "Philosophy",
    options: ["Plato", "René Descartes", "Aristotle", "Socrates"],
    answer: "René Descartes",
    explain: "Descartes wrote cogito, ergo sum in Discourse on the Method (1637).",
  },
  {
    id: "q2",
    text: "What is the capital of Japan?",
    topic: "Geography",
    options: ["Seoul", "Beijing", "Tokyo", "Bangkok"],
    answer: "Tokyo",
    explain: "Tokyo has been Japan's capital since 1868.",
  },
  {
    id: "q3",
    text: "In which year did World War II end?",
    topic: "History",
    options: ["1943", "1944", "1945", "1946"],
    answer: "1945",
    explain: "Germany surrendered in May 1945; Japan in September.",
  },
  {
    id: "q4",
    text: "Which planet is known as the Red Planet?",
    topic: "Science",
    options: ["Venus", "Mars", "Jupiter", "Mercury"],
    answer: "Mars",
    explain: "Iron oxide on its surface gives Mars its rusty color.",
  },
  {
    id: "q5",
    text: "Who wrote the novel '1984'?",
    topic: "Literature",
    options: ["Aldous Huxley", "George Orwell", "Ray Bradbury", "Franz Kafka"],
    answer: "George Orwell",
    explain: "Orwell published Nineteen Eighty-Four in 1949.",
  },
  {
    id: "q6",
    text: "What does HTTP stand for?",
    topic: "Technology",
    options: [
      "HyperText Transfer Protocol",
      "High Transfer Text Program",
      "Host Transfer Type Process",
      "Hyperlink Text Transport Path",
    ],
    answer: "HyperText Transfer Protocol",
    explain: "HTTP is the foundation of data communication on the web.",
  },
  {
    id: "q7",
    text: "Which ocean is the largest?",
    topic: "Geography",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    answer: "Pacific",
    explain: "The Pacific covers about one-third of Earth's surface.",
  },
  {
    id: "q8",
    text: "How many bits are in a byte?",
    topic: "Technology",
    options: ["4", "8", "16", "32"],
    answer: "8",
    explain: "A byte is conventionally 8 bits.",
  },
  {
    id: "q9",
    text: "Which element has the chemical symbol 'O'?",
    topic: "Science",
    options: ["Osmium", "Oxygen", "Gold", "Ozone"],
    answer: "Oxygen",
    explain: "Oxygen is atomic number 8 on the periodic table.",
  },
  {
    id: "q10",
    text: "Who painted the Mona Lisa?",
    topic: "Art",
    options: ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"],
    answer: "Leonardo da Vinci",
    explain: "Leonardo painted it in the early 1500s; it hangs in the Louvre.",
  },
  {
    id: "q11",
    text: "What is the smallest prime number?",
    topic: "Math",
    options: ["0", "1", "2", "3"],
    answer: "2",
    explain: "2 is the only even prime number.",
  },
  {
    id: "q12",
    text: "Which language is primarily spoken in Brazil?",
    topic: "Culture",
    options: ["Spanish", "Portuguese", "French", "Italian"],
    answer: "Portuguese",
    explain: "Brazil was colonized by Portugal, unlike most of South America.",
  },
];

const QUESTIONS_PER_DAY = 5;

type Phase = "ready" | "question" | "feedback" | "results";

interface QuizProgress {
  dateKey: string;
  questionIds: string[];
  index: number;
  score: number;
  selected: string | null;
  phase: Phase;
}

function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function daySeed(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

function pickQuote(seed: number) {
  return QUOTES[seed % QUOTES.length];
}

function pickQuestions(seed: number): QuizQuestion[] {
  const order = QUIZ_BANK.map((_, i) => i);
  // Deterministic Fisher–Yates so everyone gets the same daily set.
  let s = seed;
  for (let i = order.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, QUESTIONS_PER_DAY).map((i) => QUIZ_BANK[i]);
}

function storageKey(key: string) {
  return `dailymark.quiz.${key}`;
}

function loadProgress(key: string, questions: QuizQuestion[]): QuizProgress | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuizProgress;
    if (parsed.dateKey !== key) return null;
    const ids = questions.map((q) => q.id);
    if (
      !Array.isArray(parsed.questionIds) ||
      parsed.questionIds.length !== ids.length ||
      parsed.questionIds.some((id, i) => id !== ids[i])
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveProgress(progress: QuizProgress) {
  try {
    localStorage.setItem(storageKey(progress.dateKey), JSON.stringify(progress));
  } catch {
    // private mode / quota — quiz still works for the session
  }
}

export default function Daily() {
  const { streak } = useStreak();
  const key = useMemo(() => dateKey(), []);
  const seed = useMemo(() => daySeed(key), [key]);
  const quote = useMemo(() => pickQuote(seed), [seed]);
  const questions = useMemo(() => pickQuestions(seed), [seed]);

  const [progress, setProgress] = useState<QuizProgress>(() => {
    return (
      loadProgress(key, questions) ?? {
        dateKey: key,
        questionIds: questions.map((q) => q.id),
        index: 0,
        score: 0,
        selected: null,
        phase: "ready",
      }
    );
  });

  const update = useCallback((next: QuizProgress) => {
    setProgress(next);
    saveProgress(next);
  }, []);

  const current = questions[Math.min(progress.index, questions.length - 1)];
  const isCorrect = progress.selected === current.answer;
  const total = questions.length;

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
    if (progress.phase !== "question" || progress.selected) return;
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

  const playAgain = () => {
    update({
      dateKey: key,
      questionIds: questions.map((q) => q.id),
      index: 0,
      score: 0,
      selected: null,
      phase: "question",
    });
  };

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

      {/* Quote of the day */}
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

      {/* Quiz */}
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
        </div>

        {progress.phase !== "ready" && progress.phase !== "results" && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800/60 light:bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
              style={{
                width: `${((progress.index + (progress.phase === "feedback" ? 1 : 0)) / total) * 100}%`,
              }}
            />
          </div>
        )}

        {progress.phase === "ready" && (
          <div className="mt-4">
            <p className="note-title text-xl text-white light:text-slate-900">
              {total} quick questions
            </p>
            <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
              A fresh set every day. Answer, see why, then move on — finish with a score.
            </p>
            <button
              type="button"
              onClick={startQuiz}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Start today's quiz
            </button>
          </div>
        )}

        {(progress.phase === "question" || progress.phase === "feedback") && (
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {current.topic}
            </p>
            <p className="note-title mt-2 text-lg leading-snug text-white light:text-slate-900">
              {current.text}
            </p>

            <div className="mt-5 space-y-2">
              {current.options.map((opt) => {
                let cls =
                  "w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ";
                if (progress.phase === "question") {
                  cls +=
                    "border-white/5 bg-slate-800/30 text-slate-300 hover:border-amber-500/30 hover:bg-slate-800/50 light:border-slate-200 light:bg-slate-50 light:text-slate-700";
                } else if (opt === current.answer) {
                  cls += "border-green-500/30 bg-green-500/10 text-green-400";
                } else if (opt === progress.selected) {
                  cls += "border-red-500/30 bg-red-500/10 text-red-400";
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
                    className={cls}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {progress.phase === "feedback" && (
              <div className="mt-4 space-y-3">
                <div
                  className={
                    "rounded-xl p-3 text-sm " +
                    (isCorrect
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400")
                  }
                >
                  <p className="font-medium">
                    {isCorrect ? "Correct." : "Not quite — answer: " + current.answer}
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
          <div className="mt-4 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Round complete
            </p>
            <p className="note-title mt-2 text-3xl text-white light:text-slate-900">
              {progress.score} / {total}
            </p>
            <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
              {progress.score === total
                ? "Perfect — sharp work today."
                : progress.score >= Math.ceil(total * 0.6)
                  ? "Solid round. Come back tomorrow for a new set."
                  : "Good attempt. A new set lands tomorrow."}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={playAgain}
                className="flex-1 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800/60 light:border-slate-200 light:bg-white light:text-slate-700"
              >
                Play again
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
