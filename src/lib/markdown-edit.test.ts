import { describe, expect, it } from "vitest";
import {
  BULLET,
  NUMBERED,
  QUOTE,
  TASK,
  applyMdEdit,
  continueList,
  heading,
  inListContext,
  indentLines,
  insertCodeBlock,
  insertLink,
  insertTable,
  toggleLines,
  toggleTaskAtLine,
  toggleWrap,
} from "./markdown-edit";

/** Runs an edit and shows the caret/selection with pipes, like a test fixture. */
function render(value: string, edit: ReturnType<typeof toggleWrap>): string {
  const next = applyMdEdit(value, edit);
  const { selectionStart: a, selectionEnd: b } = edit;
  return a === b
    ? `${next.slice(0, a)}|${next.slice(a)}`
    : `${next.slice(0, a)}[${next.slice(a, b)}]${next.slice(b)}`;
}

describe("toggleWrap", () => {
  it("wraps a selection and keeps it selected", () => {
    expect(render("make this bold", toggleWrap("make this bold", 5, 9, "**"))).toBe(
      "make **[this]** bold"
    );
  });

  it("unwraps when the markers sit just outside the selection", () => {
    const value = "make **this** bold";
    expect(render(value, toggleWrap(value, 7, 11, "**"))).toBe("make [this] bold");
  });

  it("unwraps when the markers are inside the selection", () => {
    const value = "make **this** bold";
    expect(render(value, toggleWrap(value, 5, 13, "**"))).toBe("make [this] bold");
  });

  it("leaves trailing spaces outside the markers", () => {
    const value = "a bold word ";
    expect(render(value, toggleWrap(value, 2, 12, "**"))).toBe("a **[bold word]** ");
  });

  it("drops the caret between fresh markers when nothing is selected", () => {
    expect(render("ab", toggleWrap("ab", 1, 1, "**"))).toBe("a**|**b");
  });
});

describe("toggleLines", () => {
  it("adds bullets to every selected line", () => {
    const value = "milk\neggs\nbread";
    expect(applyMdEdit(value, toggleLines(value, 0, value.length, BULLET))).toBe(
      "- milk\n- eggs\n- bread"
    );
  });

  it("removes bullets when every line already has one", () => {
    const value = "- milk\n- eggs";
    expect(applyMdEdit(value, toggleLines(value, 0, value.length, BULLET))).toBe("milk\neggs");
  });

  it("numbers lines in order and replaces bullets", () => {
    const value = "- milk\n- eggs\n- bread";
    expect(applyMdEdit(value, toggleLines(value, 0, value.length, NUMBERED))).toBe(
      "1. milk\n2. eggs\n3. bread"
    );
  });

  it("turns a bullet list into a task list", () => {
    const value = "- milk";
    expect(applyMdEdit(value, toggleLines(value, 0, 6, TASK))).toBe("- [ ] milk");
  });

  it("keeps a list marker when quoting", () => {
    const value = "- milk";
    expect(applyMdEdit(value, toggleLines(value, 0, 6, QUOTE))).toBe("> - milk");
  });

  it("preserves indentation", () => {
    const value = "  nested";
    expect(applyMdEdit(value, toggleLines(value, 0, 8, BULLET))).toBe("  - nested");
  });

  it("skips blank lines between paragraphs", () => {
    const value = "one\n\ntwo";
    expect(applyMdEdit(value, toggleLines(value, 0, value.length, BULLET))).toBe("- one\n\n- two");
  });

  it("changes a heading's level instead of stacking hashes", () => {
    const value = "# Title";
    expect(applyMdEdit(value, toggleLines(value, 0, 0, heading(2)))).toBe("## Title");
  });

  it("removes a heading of the same level", () => {
    const value = "## Title";
    expect(applyMdEdit(value, toggleLines(value, 0, 0, heading(2)))).toBe("Title");
  });

  it("moves the caret along with the prefix it inserted", () => {
    const value = "milk\neggs";
    // Caret sits before "eggs"; after the edit it should still be before "eggs".
    expect(render(value, toggleLines(value, 5, 5, BULLET))).toBe("milk\n- |eggs");
  });
});

describe("insertLink", () => {
  it("selects the url placeholder when text was selected", () => {
    const value = "see docs";
    expect(render(value, insertLink(value, 4, 8))).toBe("see [docs]([url])");
  });

  it("turns a selected url into a link and selects the label", () => {
    const value = "https://example.com";
    expect(render(value, insertLink(value, 0, value.length))).toBe("[[text]](https://example.com)");
  });

  it("wraps the selection when a url is supplied, as when pasting one", () => {
    const value = "the docs";
    expect(render(value, insertLink(value, 4, 8, "https://x.dev"))).toBe("the [[docs]](https://x.dev)");
  });
});

describe("insertCodeBlock", () => {
  it("fences the selected lines", () => {
    const value = "line one\nline two";
    expect(applyMdEdit(value, insertCodeBlock(value, 0, value.length))).toBe(
      "```\nline one\nline two\n```"
    );
  });

  it("starts on a new line when the block follows text", () => {
    const value = "intro\n";
    expect(applyMdEdit(value, insertCodeBlock(value, 6, 6))).toBe("intro\n```\n\n```");
  });
});

describe("insertTable", () => {
  it("inserts a skeleton with the first header cell selected", () => {
    expect(render("", insertTable("", 0, 0))).toBe("| [Column] | Column |\n| --- | --- |\n|  |  |\n");
  });
});

describe("continueList", () => {
  const run = (value: string, caret: number) => {
    const edit = continueList(value, caret);
    return edit ? render(value, edit) : null;
  };

  it("carries a bullet to the next line", () => {
    expect(run("- milk", 6)).toBe("- milk\n- |");
  });

  it("increments a numbered item", () => {
    expect(run("3. third", 8)).toBe("3. third\n4. |");
  });

  it("carries an unchecked box, never a checked one", () => {
    expect(run("- [x] done", 10)).toBe("- [x] done\n- [ ] |");
  });

  it("keeps indentation of nested items", () => {
    expect(run("  - nested", 10)).toBe("  - nested\n  - |");
  });

  it("carries a quote marker", () => {
    expect(run("> quoted", 8)).toBe("> quoted\n> |");
  });

  it("leaves the list when the item is empty", () => {
    expect(run("- milk\n- ", 9)).toBe("- milk\n|");
  });

  it("splits an item when the caret is mid-line", () => {
    expect(run("- milkshake", 6)).toBe("- milk\n- |shake");
  });

  it("returns null outside a list", () => {
    expect(continueList("just prose", 10)).toBeNull();
  });
});

describe("indentLines", () => {
  it("indents and outdents by two spaces", () => {
    const value = "- one\n- two";
    const indented = applyMdEdit(value, indentLines(value, 0, value.length, 1));
    expect(indented).toBe("  - one\n  - two");
    expect(applyMdEdit(indented, indentLines(indented, 0, indented.length, -1))).toBe(value);
  });

  it("does not outdent past the margin", () => {
    expect(applyMdEdit("- one", indentLines("- one", 0, 5, -1))).toBe("- one");
  });
});

describe("inListContext", () => {
  it("is true inside a list item", () => {
    expect(inListContext("- milk", 6, 6)).toBe(true);
  });

  it("is false in ordinary prose, so Tab still moves focus", () => {
    expect(inListContext("prose", 5, 5)).toBe(false);
  });
});

describe("toggleTaskAtLine", () => {
  const source = "- [ ] one\n- [x] two\n\nplain line\n\n  - [ ] nested";

  it("ticks the box on that line", () => {
    expect(toggleTaskAtLine(source, 1)).toContain("- [x] one");
  });

  it("unticks a ticked box", () => {
    expect(toggleTaskAtLine(source, 2)).toContain("- [ ] two");
  });

  it("leaves every other line alone", () => {
    expect(toggleTaskAtLine(source, 6)).toBe(
      "- [ ] one\n- [x] two\n\nplain line\n\n  - [x] nested"
    );
  });

  it("returns null for a line without a checkbox", () => {
    expect(toggleTaskAtLine(source, 4)).toBeNull();
  });

  it("returns null for a line outside the note", () => {
    expect(toggleTaskAtLine(source, 99)).toBeNull();
    expect(toggleTaskAtLine(source, 0)).toBeNull();
  });
});
