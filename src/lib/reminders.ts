const STORAGE_KEY = "dailymark.reminder";
const FIRED_KEY = "dailymark.reminder.fired";

export interface ReminderPrefs {
  enabled: boolean;
  /** Local time as HH:MM (24h). */
  time: string;
}

const DEFAULT: ReminderPrefs = { enabled: false, time: "20:00" };

export function loadReminderPrefs(): ReminderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<ReminderPrefs>;
    const time =
      typeof parsed.time === "string" && /^\d{2}:\d{2}$/.test(parsed.time)
        ? parsed.time
        : DEFAULT.time;
    return { enabled: Boolean(parsed.enabled), time };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveReminderPrefs(prefs: ReminderPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function alreadyFiredToday(): boolean {
  try {
    return localStorage.getItem(FIRED_KEY) === todayKey();
  } catch {
    return false;
  }
}

function markFiredToday(): void {
  try {
    localStorage.setItem(FIRED_KEY, todayKey());
  } catch {
    // ignore
  }
}

/** Fire a local notification when the preferred time arrives (once per day). */
export function tickReminder(prefs: ReminderPrefs = loadReminderPrefs()): void {
  if (!prefs.enabled) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (alreadyFiredToday()) return;

  const [h, m] = prefs.time.split(":").map(Number);
  const now = new Date();
  if (now.getHours() < h || (now.getHours() === h && now.getMinutes() < m)) return;

  try {
    new Notification("DailyMark", {
      body: "Time for a quick note or today's quiz.",
      tag: "dailymark-daily",
    });
    markFiredToday();
  } catch {
    // Some browsers block constructors outside a service worker.
  }
}

/** Start a lightweight poller; returns a cleanup function. */
export function startReminderLoop(): () => void {
  tickReminder();
  const id = window.setInterval(() => tickReminder(), 60_000);
  const onVis = () => {
    if (document.visibilityState === "visible") tickReminder();
  };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVis);
  };
}
