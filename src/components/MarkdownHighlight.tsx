import { memo, useMemo } from "react";
import { tokenizeMarkdown, type MdToken, type MdTokenKind } from "../lib/markdown";

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

function sameTokens(a: MdToken[], b: MdToken[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].kind !== b[i].kind || a[i].text !== b[i].text) return false;
  }
  return true;
}

/**
 * One source line. The tokenizer hands back fresh arrays every keystroke, so
 * the comparator looks at token content rather than identity — comparing a few
 * strings is orders of magnitude cheaper than rebuilding the line's elements.
 */
const Line = memo(
  function Line({ tokens }: { tokens: MdToken[] }) {
    return (
      <span>
        {tokens.map((token, index) => (
          <span key={index} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        ))}
        {"\n"}
      </span>
    );
  },
  (prev, next) => sameTokens(prev.tokens, next.tokens)
);

/**
 * Paints the Markdown in the editor while it is being typed. It sits behind a
 * transparent `<textarea>` showing the exact same characters, so every style
 * here has to be metric-neutral — colour, weight faked with a text shadow,
 * underlines, backgrounds. Anything that changes glyph advances (a real bold
 * face, a larger font size) would slide the caret off the text under it.
 *
 * This mirror *is* the visible text, so unlike the rich preview it cannot be
 * deferred — a low-priority repaint would show characters arriving after the
 * caret had already moved past them. It stays synchronous and gets cheap
 * instead: the tokenizer still runs over the whole source (a few ms even on a
 * long note, and it has to, because a fence opened on line 3 changes line 300),
 * but each line is memoized on its token content, so a keystroke re-renders
 * the one line it touched rather than every span in the document. In an
 * 8 000-word note that is one line instead of ~7 000 spans.
 */
export default function MarkdownHighlight({ source }: { source: string }) {
  const lines = useMemo(() => tokenizeMarkdown(source), [source]);

  return (
    <div className="md-mirror" aria-hidden="true">
      {lines.map((tokens, line) => (
        <Line key={line} tokens={tokens} />
      ))}
    </div>
  );
}
