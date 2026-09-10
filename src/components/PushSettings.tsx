import { useState } from "react";
import { requireSupabase, errorMessage } from "../lib/supabase";
import { usePrefs } from "../context/prefs-context";
export default function PushSettings() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { prefs, patchPrefs } = usePrefs();
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  const configure = async (enable: boolean) => {
    setBusy(true);
    setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw new Error(
          "Background notifications are not supported in this browser.",
        );
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration)
        throw new Error(
          "Open the installed or production app to configure background reminders.",
        );
      let sub = await registration.pushManager.getSubscription();
      if (enable) {
        if ((await Notification.requestPermission()) !== "granted")
          throw new Error(
            "Allow notifications in your browser settings first.",
          );
        if (!sub) {
          const padded = key.replace(/-/g, "+").replace(/_/g, "/");
          const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: bytes,
          });
        }
        const json = sub.toJSON();
        const { error } = await requireSupabase()
          .from("push_subscriptions")
          .upsert(
            {
              endpoint: sub.endpoint,
              p256dh: json.keys!.p256dh,
              auth: json.keys!.auth,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            { onConflict: "endpoint" },
          );
        if (error) throw error;
        await patchPrefs({
          reminder: {
            ...prefs.reminder,
            enabled: true,
            time: prefs.reminder?.time ?? "20:00",
          },
        });
        setMessage("Background reminders enabled for this browser.");
      } else {
        if (sub) {
          const { error } = await requireSupabase()
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
          if (error) throw error;
          await sub.unsubscribe();
        }
        setMessage("Background reminders disabled for this browser.");
      }
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="feature-panel glass mb-4 rounded-2xl p-4">
      <h2>Background reminders</h2>
      <p className="my-2 text-sm text-muted">
        Receive a reminder at your chosen time even when DailyMark is closed.
        Delivery depends on your browser and device settings.
      </p>
      {key ? (
        <>
          <button disabled={busy} onClick={() => void configure(true)}>
            Enable on this browser
          </button>
          <button disabled={busy} onClick={() => void configure(false)}>
            Disable on this browser
          </button>
        </>
      ) : (
        <p className="text-sm text-muted">
          Background reminders are not available on this installation yet.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
