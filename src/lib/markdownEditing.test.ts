import { describe, expect, it } from "vitest";
import {
  continueBlock,
  indentBlock,
  insertLink,
  togglePrefix,
  toggleWrap,
  type TextEdit,
} from "./markdownEditing";

/** Applies an edit and renders the caret as `|` (or the selection as `|…|`). */
function render(value: string, edit: TextEdit | null) {
  if (!edit) return null;
  const next = value.slice(0, edit.start) + edit.text + value.slice(edit.end);
  const { selectionStart: s, selectionEnd: e } = edit;
  return s === e
    ? next.slice(0, s) + "|" + next.slice(s)
    : next.slice(0, s) + "|" + next.slice(s, e) + "|" + next.slice(e);
}

/** Splits `"a|b"` into the value plus caret offset. */
function at(marked: string): [string, number] {
  const caret = marked.indexOf("|");
  return [marked.replace("|", ""), caret];
}

describe("continueBlock", () => {
  it("carries a bullet marker to the next line", () => {
    const [value, caret] = at("- milk|");
    expect(render(value, continueBlock(value, caret))).toBe("- milk\n- |");
  });

  it("increments ordered list numbers", () => {
    const [value, caret] = at("1. first\n2. second|");
    expect(render(value, continueBlock(value, caret))).toBe("1. first\n2. second\n3. |");
  });

  it("starts the next task unchecked", () => {
    const [value, caret] = at("- [x] ship it|");
    expect(render(value, continueBlock(value, caret))).toBe("- [x] ship it\n- [ ] |");
  });

  it("keeps the indent of nested items", () => {
    const [value, caret] = at("- one\n  - two|");
    expect(render(value, continueBlock(value, caret))).toBe("- one\n  - two\n  - |");
  });

  it("continues blockquotes", () => {
    const [value, caret] = at("> quoted|");
    expect(render(value, continueBlock(value, caret))).toBe("> quoted\n> |");
  });

  it("removes the marker instead when the item is still empty", () => {
    const [value, caret] = at("- one\n- |");
    expect(render(value, continueBlock(value, caret))).toBe("- one\n|");
  });

  it("stays out of the way in plain paragraphs", () => {
    const [value, caret] = at("just text|");
    expect(continueBlock(value, caret)).toBeNull();
  });

  it("does not fire mid-marker", () => {
    const [value, caret] = at("-| milk");
    expect(continueBlock(value, caret)).toBeNull();
  });
});

describe("toggleWrap", () => {
  it("wraps a selection", () => {
    expect(render("make bold now", toggleWrap("make bold now", 5, 9, "**", "bold"))).toBe(
      "make **|bold|** now"
    );
  });

  it("unwraps a selection that already includes the markers", () => {
    expect(render("a **bold** b", toggleWrap("a **bold** b", 2, 10, "**", "bold"))).toBe("a |bold| b");
  });

  it("unwraps when the markers sit just outside the selection", () => {
    expect(render("a **bold** b", toggleWrap("a **bold** b", 4, 8, "**", "bold"))).toBe("a |bold| b");
  });

  it("drops in a selected placeholder when nothing is selected", () => {
    expect(render("", toggleWrap("", 0, 0, "*", "italic"))).toBe("*|italic|*");
  });
});

describe("togglePrefix", () => {
  it("adds the prefix to every selected line", () => {
    const value = "one\ntwo";
    expect(render(value, togglePrefix(value, 0, value.length, "- "))).toBe("|- one\n- two|");
  });

  it("strips the prefix when all lines already have it", () => {
    const value = "- one\n- two";
    expect(render(value, togglePrefix(value, 0, value.length, "- "))).toBe("|one\ntwo|");
  });

  it("keeps existing indentation", () => {
    const value = "  nested";
    expect(render(value, togglePrefix(value, 8, 8, "- "))).toBe("  - nested|");
  });
});

describe("indentBlock", () => {
  it("indents by two spaces", () => {
    const value = "- one";
    expect(render(value, indentBlock(value, 5, 5, false))).toBe("  - one|");
  });

  it("outdents at most two spaces", () => {
    const value = "  - one";
    expect(render(value, indentBlock(value, 7, 7, true))).toBe("- one|");
  });

  it("shifts every line of a multi-line selection", () => {
    const value = "- one\n- two";
    expect(render(value, indentBlock(value, 0, value.length, false))).toBe("|  - one\n  - two|");
  });
});

describe("insertLink", () => {
  it("turns the selection into a label and selects the url slot", () => {
    expect(render("see docs", insertLink("see docs", 4, 8))).toBe("see [docs](|url|)");
  });

  it("provides a label when nothing is selected", () => {
    expect(render("", insertLink("", 0, 0))).toBe("[link text](|url|)");
  });
});
