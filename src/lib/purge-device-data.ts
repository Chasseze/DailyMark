/**
 * One-shot wipe of everything DailyMark used to keep in the browser.
 *
 * Earlier builds mirrored the whole account into IndexedDB and queued edits in
 * an outbox there. That copy is gone from the code, but it is still sitting in
 * the browsers of anyone who used those builds — a stale second source of truth
 * that nothing reads any more. This deletes it on boot so no device is carrying
 * an old picture of the account around.
 *
 * The one thing deliberately left alone is the Supabase auth token. That is the
 * sign-in credential, not app data; clearing it would just log everyone out on
 * every load. No note, pref, quiz result or Return mark is stored here.
 */

/** Databases past versions of the app created. Never add a new one. */
const LEGACY_DATABASES = ["dailymark-notes-v2", "dailymark-notes"];

/** localStorage keys past versions wrote. `sb-*-auth-token` is not one of them. */
const LEGACY_KEY_PATTERN = /^(dailymark|dm)[-.:]/i;

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.deleteDatabase(name);
    } catch {
      resolve();
      return;
    }
    // `blocked` fires when another tab still holds the database open. Resolve
    // anyway: that tab is running this same purge and will finish the job.
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

function purgeWebStorage(store: Storage): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && LEGACY_KEY_PATTERN.test(key)) doomed.push(key);
    }
    for (const key of doomed) store.removeItem(key);
  } catch {
    // Private mode / storage disabled — nothing was stored to begin with.
  }
}

/** Runs on every load. Cheap once the databases are gone. */
export async function purgeDeviceData(): Promise<void> {
  purgeWebStorage(window.localStorage);
  purgeWebStorage(window.sessionStorage);

  if (typeof indexedDB === "undefined") return;
  try {
    await Promise.all(LEGACY_DATABASES.map(deleteDatabase));
  } catch {
    // Best effort: a browser that refuses the delete is not a reason to fail
    // boot, and nothing reads those databases any more either way.
  }
}
