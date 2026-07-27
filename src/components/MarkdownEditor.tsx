import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  onChange: (content: string) => void;
}

export default function MarkdownEditor({ content, onChange }: Props) {
  const [mode, setMode] = useState<"write" | "preview" | "split">("write");

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
          <div className={mode === "split" ? "min-h-[300px]" : ""}>
            <textarea
              value={content}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Start writing in Markdown..."
              className="editor-textarea w-full rounded-2xl border border-white/5 bg-slate-900/50 p-4 text-sm text-white placeholder-slate-500 focus:border-amber-500/30 focus:outline-none light:border-slate-200 light:bg-slate-50 light:text-slate-900 light:placeholder-slate-400"
            />
          </div>
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
    </div>
  );
}
