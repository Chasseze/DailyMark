import { useMemo } from "react";
import { tokenizeMarkdown, type MdTokenKind } from "../lib/markdown";

const TOKEN_CLASS: Record<MdTokenKind, string> = {
  text: "",
  syntax: "md-syntax",
  heading: "md-heading",
  strong: "md-strong",
  em: "md-em",
  "strong-em": "md-strong md-em",
  strike: "md-strike",
  code: "md-code-span",
  "code-block": "md-code-span",
  link: "md-link-text",
  url: "md-url",
  quote: "md-quote",
  marker: "md-marker",
  "task-done": "md-task-done",
  rule: "md-rule",
  table: "md-syntax",
};

/**
 * Paints the Markdown in the editor while it is being typed. It sits behind a
 * transparent `<textarea>` showing the exact same characters, so every style
 * here has to be metric-neutral — colour, weight faked with a text shadow,
 * underlines, backgrounds. Anything that changes glyph advances (a real bold
 * face, a larger font size) would slide the caret off the text under it.
 */
export default function MarkdownHighlight({ source }: { source: string }) {
  const lines = useMemo(() => tokenizeMarkdown(source), [source]);

  return (
    <div className="md-mirror" aria-hidden="true">
      {lines.map((tokens, line) => (
        <span key={line}>
          {tokens.map((token, index) => (
            <span key={index} className={TOKEN_CLASS[token.kind]}>
              {token.text}
            </span>
          ))}
          {"\n"}
        </span>
      ))}
    </div>
  );
}
