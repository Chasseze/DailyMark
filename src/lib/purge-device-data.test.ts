import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { purgeDeviceData } from "./purge-device-data";

function fakeStorage(seed: Record<string, string>): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as Storage;
}

function fakeIndexedDB(deleted: string[]) {
  return {
    deleteDatabase(name: string) {
      deleted.push(name);
      const req = {} as IDBOpenDBRequest & { onsuccess: (() => void) | null };
      queueMicrotask(() => req.onsuccess?.());
      return req as IDBOpenDBRequest;
    },
  };
}

let deleted: string[];

beforeEach(() => {
  deleted = [];
  vi.stubGlobal("indexedDB", fakeIndexedDB(deleted));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("purgeDeviceData", () => {
  it("deletes the IndexedDB databases older builds created", async () => {
    vi.stubGlobal("window", {
      localStorage: fakeStorage({}),
      sessionStorage: fakeStorage({}),
    });

    await purgeDeviceData();

    expect(deleted).toContain("dailymark-notes-v2");
    expect(deleted).toContain("dailymark-notes");
  });

  it("removes app keys from web storage but never the sign-in token", async () => {
    const local = fakeStorage({
      "dailymark.notes": "[]",
      "dm:quiz-progress": "{}",
      "sb-abcdef-auth-token": "session",
      "unrelated-app": "keep",
    });
    const session = fakeStorage({ "dailymark.draft": "hello" });
    vi.stubGlobal("window", { localStorage: local, sessionStorage: session });

    await purgeDeviceData();

    expect(local.getItem("dailymark.notes")).toBeNull();
    expect(local.getItem("dm:quiz-progress")).toBeNull();
    expect(session.getItem("dailymark.draft")).toBeNull();
    // Clearing this would sign the user out on every single load.
    expect(local.getItem("sb-abcdef-auth-token")).toBe("session");
    expect(local.getItem("unrelated-app")).toBe("keep");
  });

  it("resolves when the browser refuses to touch storage at all", async () => {
    const thrower = {
      get length(): number {
        throw new Error("storage disabled");
      },
    } as unknown as Storage;
    vi.stubGlobal("window", { localStorage: thrower, sessionStorage: thrower });
    vi.stubGlobal("indexedDB", {
      deleteDatabase() {
        throw new Error("blocked");
      },
    });

    await expect(purgeDeviceData()).resolves.toBeUndefined();
  });
});
