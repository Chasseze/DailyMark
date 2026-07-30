import { describe, expect, it } from "vitest";
import {
  analyzeMarkdown,
  recognizedFeatures,
  tokenizeMarkdown,
  tokensToCells,
  tokensToText,
  type MarkdownToken,
} from "./markdown";

/** Reduces a line to `kind:text` pairs so assertions stay readable. */
function shape(tokens: MarkdownToken[]) {
  return tokens.map((t) => `${t.kind}:${t.text}`);
}

function line(source: string) {
  return tokenizeMarkdown(source)[0];
}

describe("tokenizeMarkdown", () => {
  it("separates heading markers from heading text", () => {
    const heading = line("## Groceries");
    expect(heading.block).toBe("heading");
    expect(heading.level).toBe(2);
    expect(shape(heading.tokens)).toEqual(["syntax:##", "heading: Groceries"]);
  });

  it("recognizes bold, italic and strikethrough spans", () => {
    expect(shape(line("**hi**").tokens)).toEqual(["syntax:**", "strong:hi", "syntax:**"]);
    expect(shape(line("*hi*").tokens)).toEqual(["syntax:*", "em:hi", "syntax:*"]);
    expect(shape(line("~~hi~~").tokens)).toEqual(["syntax:~~", "strike:hi", "syntax:~~"]);
  });

  it("leaves underscores inside words alone", () => {
    expect(shape(line("call get_user_name now").tokens)).toEqual(["text:call get_user_name now"]);
    expect(shape(line("_emphasis_").tokens)).toEqual(["syntax:_", "em:emphasis", "syntax:_"]);
  });

  it("keeps escaped markers as plain text", () => {
    expect(shape(line("\\*not italic\\*").tokens)).toEqual(["text:\\*not italic\\*"]);
  });

  it("splits inline code from its backticks", () => {
    expect(shape(line("run `npm test` twice").tokens)).toEqual([
      "text:run ",
      "syntax:`",
      "code:npm test",
      "syntax:`",
      "text: twice",
    ]);
  });

  it("splits links and images into label and target", () => {
    expect(shape(line("see [docs](https://x.dev)").tokens)).toEqual([
      "text:see ",
      "syntax:[",
      "link:docs",
      "syntax:](",
      "url:https://x.dev",
      "syntax:)",
    ]);
    expect(shape(line("![a cat](cat.png)").tokens)).toEqual([
      "syntax:![",
      "image:a cat",
      "syntax:](",
      "url:cat.png",
      "syntax:)",
    ]);
  });

  it("marks list items, task state and indent depth", () => {
    expect(line("- milk").block).toBe("bullet");
    expect(line("1. milk").block).toBe("ordered");

    const done = line("- [x] ship it");
    expect(done.block).toBe("task");
    expect(done.flag).toBe(true);
    expect(shape(done.tokens)).toEqual(["syntax:- ", "checkbox-done:[x]", "syntax: ", "done:ship it"]);

    const open = line("    - [ ] later");
    expect(open.flag).toBe(false);
    expect(open.level).toBe(2);
  });

  it("treats fenced blocks as code until the closing fence", () => {
    const lines = tokenizeMarkdown("```js\nconst a = **1**;\n```\nafter");
    expect(lines.map((l) => l.block)).toEqual(["fence", "code", "fence", "paragraph"]);
    expect(shape(lines[1].tokens)).toEqual(["codeblock:const a = **1**;"]);
  });

  it("recognizes quotes, rules and table rows", () => {
    expect(line("> quoted").block).toBe("quote");
    expect(line("---").block).toBe("rule");

    const rows = tokenizeMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |");
    expect(rows.map((r) => r.block)).toEqual(["table", "table", "table"]);
    expect(rows[1].flag).toBe(true);
    expect(tokensToCells(rows[0].tokens)).toEqual(["a", "b"]);
  });
});

describe("tokensToText", () => {
  it("drops markdown punctuation and link targets", () => {
    expect(tokensToText(line("**bold** and [docs](https://x.dev)").tokens)).toBe("bold and docs");
    expect(tokensToText(line("- [x] ship it").tokens)).toBe("ship it");
  });
});

const SAMPLE = `# Trip notes

Packed **early** and left at *dawn*.

- [x] tickets
- [ ] passport
- snacks

> The road was empty.

| leg | hours |
| --- | --- |
| north | 3 |

\`\`\`sh
echo hi
\`\`\`

Use \`git status\`, see [map](https://maps.dev).

---
`;

describe("analyzeMarkdown", () => {
  const stats = analyzeMarkdown(SAMPLE);

  it("counts the formatting it recognized", () => {
    expect(stats).toMatchObject({
      headings: 1,
      bold: 1,
      italic: 1,
      inlineCode: 1,
      codeBlocks: 1,
      links: 1,
      bulletItems: 1,
      tasksTotal: 2,
      tasksDone: 1,
      quoteLines: 1,
      tables: 1,
      rules: 1,
    });
  });

  it("counts words without counting markdown punctuation", () => {
    expect(analyzeMarkdown("## **Two** words").words).toBe(2);
  });

  it("reports nothing for plain text", () => {
    expect(recognizedFeatures(analyzeMarkdown("just a sentence"))).toEqual([]);
  });

  it("describes findings as chips", () => {
    const labels = recognizedFeatures(stats).map((f) => f.label);
    expect(labels).toContain("1 heading");
    expect(labels).toContain("1/2 tasks done");
    expect(labels).toContain("1 code block");
  });
});
