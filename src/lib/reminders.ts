import { dayKey } from "./rhythm";

export interface ReminderPrefs {
  enabled: boolean;
  /** Local time as HH:MM (24h). */
  time: string;
}

export const DEFAULT_REMINDER: ReminderPrefs = { enabled: false, time: "20:00" };

let livePrefs: ReminderPrefs = { ...DEFAULT_REMINDER };

/**
 * The day this tab last fired the nudge. It is deliberately in memory only:
 * a reminder is a property of this open tab, not of the account, and storing
 * it on the device was the last thing keeping IndexedDB alive. Worst case a
 * reload after the reminder time shows it twice in one day.
 */
let firedDay: string | null = null;

export function getReminderPrefs(): ReminderPrefs {
  return { ...livePrefs };
}

export function setReminderPrefs(prefs: ReminderPrefs): void {
  livePrefs = {
    enabled: Boolean(prefs.enabled),
    time:
      typeof prefs.time === "string" && /^\d{2}:\d{2}$/.test(prefs.time)
        ? prefs.time
        : DEFAULT_REMINDER.time,
  };
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

/** Fire a local notification when the preferred time arrives (once per day). */
export function tickReminder(prefs: ReminderPrefs = livePrefs): void {
  if (!prefs.enabled) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const [h, m] = prefs.time.split(":").map(Number);
  const now = new Date();
  if (now.getHours() < h || (now.getHours() === h && now.getMinutes() < m)) return;

  const today = dayKey(now);
  if (firedDay === today) return;
  try {
    new Notification("DailyMark", {
      body: "Time for a quick note or today's quiz.",
      tag: "dailymark-daily",
    });
    firedDay = today;
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
