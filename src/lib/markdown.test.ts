import { describe, expect, it } from "vitest";
import {
  looksLikeMarkdown,
  markdownExcerpt,
  markdownPreview,
  markdownToPlainText,
  tokenizeMarkdown,
} from "./markdown";

const SAMPLES = [
  "",
  "\n",
  "plain prose with no syntax at all",
  "# Heading one\n## Heading two\n###### Heading six",
  "#not a heading\n#\t tabbed heading",
  "Some **bold**, some *italic*, some ***both***, some ~~gone~~.",
  "Nested **bold with `code` and [a link](https://example.com) inside**.",
  "snake_case_identifier stays intact but _emphasis_ does not.",
  "- one\n- two\n  - nested\n1. first\n2) second",
  "- [ ] unchecked task\n- [x] checked task\n- [X] shouty task",
  "> quoted line\n> > deeply quoted\n> - quoted bullet",
  "| Name | Age |\n| --- | ---: |\n| Ada | 36 |",
  "```js\nconst x = 1; // # not a heading\n```",
  "~~~\nfenced with tildes\n~~~",
  "```unclosed fence\nstill code",
  "---\n***\n___\n- - -",
  "An ![image](pic.png) and an <https://example.com> autolink and a bare https://example.org/x link.",
  "Escaped \\*not emphasis\\* and a lone * star and __ empty underscores.",
  "trailing spaces   \nand a `` double `tick` `` span",
  "*",
  "**",
  "***",
  "`",
  "[unclosed](",
  "text with | pipe but not a table",
];

/** Every character of the source has to survive tokenizing, in order. */
function roundTrip(source: string): string {
  return tokenizeMarkdown(source)
    .map((tokens) => tokens.map((t) => t.text).join(""))
    .join("\n");
}

describe("tokenizeMarkdown", () => {
  it.each(SAMPLES)("reproduces the source exactly: %j", (source) => {
    expect(roundTrip(source)).toBe(source);
  });

  it("survives random punctuation soup", () => {
    const alphabet = "#*_-`[]()>|~\\ \nAb1.!";
    let seed = 20260730;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };

    for (let i = 0; i < 400; i++) {
      const length = 1 + Math.floor(random() * 40);
      let source = "";
      for (let j = 0; j < length; j++) {
        source += alphabet[Math.floor(random() * alphabet.length)];
      }
      expect(roundTrip(source)).toBe(source);
    }
  });

  it("marks heading syntax separately from heading text", () => {
    expect(tokenizeMarkdown("## Groceries")).toEqual([
      [
        { kind: "syntax", text: "## " },
        { kind: "heading", text: "Groceries" },
      ],
    ]);
  });

  it("tags emphasis markers as syntax and the inner text as emphasis", () => {
    expect(tokenizeMarkdown("a **b** c")).toEqual([
      [
        { kind: "text", text: "a " },
        { kind: "syntax", text: "**" },
        { kind: "strong", text: "b" },
        { kind: "syntax", text: "**" },
        { kind: "text", text: " c" },
      ],
    ]);
  });

  it("treats a checked task's text as done", () => {
    const [line] = tokenizeMarkdown("- [x] buy milk");
    expect(line).toEqual([
      { kind: "marker", text: "- " },
      { kind: "marker", text: "[x] " },
      { kind: "task-done", text: "buy milk" },
    ]);
  });

  it("keeps fenced code out of inline parsing", () => {
    const lines = tokenizeMarkdown("```\n**not bold**\n```");
    expect(lines[1]).toEqual([{ kind: "code-block", text: "**not bold**" }]);
  });

  it("does not read an underscore inside a word as emphasis", () => {
    const [line] = tokenizeMarkdown("some_var_name");
    expect(line).toEqual([{ kind: "text", text: "some_var_name" }]);
  });
});

describe("markdownToPlainText", () => {
  it("drops syntax, bullets and URLs", () => {
    const source = [
      "# Trip notes",
      "",
      "Pack **light** and bring a *hat*.",
      "",
      "- [ ] sunscreen",
      "- [x] passport",
      "",
      "> Leave early.",
      "",
      "See [the map](https://maps.example.com/very/long/url).",
    ].join("\n");

    expect(markdownToPlainText(source)).toBe(
      ["Trip notes", "Pack light and bring a hat.", "sunscreen", "passport", "Leave early.", "See the map."].join("\n")
    );
  });

  it("reads table rows as comma separated cells", () => {
    const source = "| Name | Age |\n| --- | --- |\n| Ada | 36 |";
    expect(markdownToPlainText(source)).toBe("Name, Age\nAda, 36");
  });

  it("skips fenced code bodies rather than spelling them out", () => {
    expect(markdownToPlainText("Run this:\n\n```sh\nnpm run dev\n```\n\nThen relax.")).toBe(
      "Run this:\nThen relax."
    );
  });

  it("keeps inline code, which is usually a word", () => {
    expect(markdownToPlainText("Use `npm` for that.")).toBe("Use npm for that.");
  });

  it("returns nothing for content that is only syntax", () => {
    expect(markdownToPlainText("---\n\n***\n")).toBe("");
  });
});

describe("markdownExcerpt", () => {
  it("collapses to one line and ellipsises", () => {
    expect(markdownExcerpt("# Title\n\nBody text here.", 10)).toBe("Title Body…");
  });
});

describe("markdownPreview", () => {
  it("cuts on line boundaries", () => {
    const source = "# Heading\n\n- one\n- two\n- three\n- four";
    expect(markdownPreview(source, 20)).toBe("# Heading\n\n- one");
  });

  it("closes a fence it cut through", () => {
    expect(markdownPreview("```\ncode line\nmore code", 20)).toBe("```\ncode line\n```");
  });

  it("skips leading blank lines", () => {
    expect(markdownPreview("\n\n# Later start", 40)).toBe("# Later start");
  });
});

describe("looksLikeMarkdown", () => {
  it.each(["# heading", "- item", "1. item", "**bold**", "`code`", "[a](b)", "> quote", "| a | b |"])(
    "recognises %j",
    (text) => {
      expect(looksLikeMarkdown(text)).toBe(true);
    }
  );

  it("ignores ordinary prose", () => {
    expect(looksLikeMarkdown("Just a sentence, with a comma - and a dash.")).toBe(false);
  });
});
