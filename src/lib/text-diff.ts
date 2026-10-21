export type TextChange = { kind: "same" | "removed" | "added"; text: string };

/** Exact line comparison, bounded so long articles cannot allocate an enormous
 * LCS matrix. Large rewrites fall back to one removed/added middle section. */
export function compareText(original: string, current: string): TextChange[] {
  const a = original.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const b = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const changes: TextChange[] = [];
  const add = (kind: TextChange["kind"], text: string) => {
    if (!text) return;
    const last = changes.at(-1);
    if (last?.kind === kind) last.text += text;
    else changes.push({ kind, text });
  };
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  add("same", a.slice(0, start).join(""));
  const left = a.slice(start, a.length - end);
  const right = b.slice(start, b.length - end);
  const width = right.length + 1;
  if ((left.length + 1) * width > 250_000) {
    add("removed", left.join(""));
    add("added", right.join(""));
  } else {
    const lengths = new Uint32Array((left.length + 1) * width);
    for (let i = left.length - 1; i >= 0; i--)
      for (let j = right.length - 1; j >= 0; j--)
        lengths[i * width + j] = left[i] === right[j]
          ? 1 + lengths[(i + 1) * width + j + 1]
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    let i = 0, j = 0;
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length && left[i] === right[j]) {
        add("same", left[i++]); j++;
      } else if (i < left.length && (j === right.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
        add("removed", left[i++]);
      } else add("added", right[j++]);
    }
  }
  add("same", end ? a.slice(a.length - end).join("") : "");
  return changes;
}
