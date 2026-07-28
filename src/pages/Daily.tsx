import { useState, useMemo } from "react";
import { useStreak } from "../hooks/useStreak";

interface DailyItem {
  id: string;
  type: "quote" | "quiz";
  text: string;
  source: string;
  options?: string[];
  answer?: string;
}

const PROMPTS: DailyItem[] = [
  { id: "1", type: "quote", text: "The only way to do great work is to love what you do.", source: "Steve Jobs" },
  { id: "2", type: "quiz", text: "Which philosopher said 'I think, therefore I am'?", source: "Philosophy", options: ["Plato", "René Descartes", "Aristotle", "Socrates"], answer: "René Descartes" },
  { id: "3", type: "quote", text: "Simplicity is the ultimate sophistication.", source: "Leonardo da Vinci" },
  { id: "4", type: "quiz", text: "What is the capital of Japan?", source: "Geography", options: ["Seoul", "Beijing", "Tokyo", "Bangkok"], answer: "Tokyo" },
  { id: "5", type: "quote", text: "Stay hungry, stay foolish.", source: "Steve Jobs" },
  { id: "6", type: "quote", text: "The journey of a thousand miles begins with a single step.", source: "Lao Tzu" },
  { id: "7", type: "quiz", text: "In which year did World War II end?", source: "History", options: ["1943", "1944", "1945", "1946"], answer: "1945" },
];

function getTodayIndex(total: number) {
  const days = Math.floor((Date.now() - new Date(2026, 6, 1).getTime()) / 86400000);
  return ((days % total) + total) % total; // stays in range before the epoch date
}

export default function Daily() {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const { streak } = useStreak();

  const today = useMemo(() => PROMPTS[getTodayIndex(PROMPTS.length)], []);

  const isCorrect = selectedAnswer === today.answer;

  return (
    <div className="animate-in px-4 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="page-title text-white light:text-slate-900">daily spark</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5">
          <span className="text-lg">🔥</span>
          <span className="text-sm font-bold text-amber-400">{streak ?? "–"}</span>
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <span className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
          {today.type === "quote" ? "💬 Quote of the Day" : "🧠 Daily Quiz"}
        </span>
        <p className="mt-4 text-lg leading-relaxed text-white light:text-slate-900">{today.text}</p>

        {today.type === "quote" && (
          <p className="mt-3 text-sm text-slate-400">— {today.source}</p>
        )}

        {today.type === "quiz" && today.options && (
          <div className="mt-5 space-y-2">
            {today.options.map((opt) => {
              let cls = "w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ";
              if (!selectedAnswer) {
                cls += "border-white/5 bg-slate-800/30 text-slate-300 hover:border-amber-500/30 hover:bg-slate-800/50 light:border-slate-200 light:bg-slate-50 light:text-slate-700";
              } else if (opt === today.answer) {
                cls += "border-green-500/30 bg-green-500/10 text-green-400";
              } else if (opt === selectedAnswer && !isCorrect) {
                cls += "border-red-500/30 bg-red-500/10 text-red-400";
              } else {
                cls += "border-white/5 bg-slate-800/20 text-slate-600 light:border-slate-200 light:bg-slate-50";
              }
              return (
                <button key={opt} onClick={() => !selectedAnswer && setSelectedAnswer(opt)}
                  disabled={!!selectedAnswer} className={cls}>
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {selectedAnswer && (
          <div className={
            "mt-4 rounded-xl p-3 text-sm font-medium " +
            (isCorrect ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")
          }>
            {isCorrect ? "✅ Correct! Well done." : "❌ Not quite. The answer is: " + today.answer}
          </div>
        )}
      </div>

      {today.type === "quote" && (
        <div className="mt-4 glass rounded-2xl p-4">
          <p className="text-sm text-slate-400 light:text-slate-500">
            What does this quote mean to you? <span className="text-amber-400">Jot it down →</span>
          </p>
        </div>
      )}
    </div>
  );
}
