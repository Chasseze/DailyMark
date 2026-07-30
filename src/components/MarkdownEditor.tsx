import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MarkdownInput from "./MarkdownInput";
import { analyzeMarkdown, recognizedFeatures } from "../lib/markdown";

interface Props {
  content: string;
  onChange: (content: string) => void;
}

export default function MarkdownEditor({ content, onChange }: Props) {
  const [mode, setMode] = useState<"write" | "preview" | "split">("write");
  const stats = useMemo(() => analyzeMarkdown(content), [content]);
  const features = useMemo(() => recognizedFeatures(stats), [stats]);

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-xl bg-slate-800/50 p-1 light:bg-slate-100">
        {(["write", "preview", "split"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={
              "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all " +
              (mode === m
                ? "bg-amber-500/20 text-amber-400"
                : "text-slate-400 hover:text-slate-200 light:hover:text-slate-700")
            }
          >
            {m}
          </button>
        ))}
      </div>

      <div className={mode === "split" ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "block"}>
        {(mode === "write" || mode === "split") && (
          <MarkdownInput
            value={content}
            onChange={onChange}
            placeholder="Start writing in Markdown…"
          />
        )}
        {(mode === "preview" || mode === "split") && (
          <div className="prose-custom rounded-2xl border border-white/5 bg-slate-900/30 p-4 text-sm text-slate-300 light:border-slate-200 light:bg-slate-50 light:text-slate-700">
            {content.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p className="text-slate-500 italic">Preview will appear here...</p>
            )}
          </div>
        )}
      </div>

      {/* What the editor recognized in the text, refreshed as you type. */}
      <div className="mt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">Recognized</span>
          {features.length ? (
            features.map((feature) => (
              <span
                key={feature.id}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400"
              >
                <code className="font-mono text-[10px] text-amber-500/80">{feature.hint}</code>
                {feature.label}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-slate-500">
              plain text — try <code className="font-mono">#</code> heading,{" "}
              <code className="font-mono">- [ ]</code> task or <code className="font-mono">**bold**</code>
            </span>
          )}
          {stats.words > 0 && (
            <span className="ml-auto text-[11px] text-slate-500">{stats.words} words</span>
          )}
        </div>
      </div>
    </div>
  );
}
