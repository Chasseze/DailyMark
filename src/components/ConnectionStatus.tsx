import { useEffect, useState } from "react";
export default function ConnectionStatus() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    const settings = () =>
      setMessage(
        "Settings could not be saved to your account. Reconnect and try again.",
      );
    const reminder = () =>
      setMessage(
        "Your browser could not display the reminder. Check notification permissions in browser settings.",
      );
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("dailymark-settings-error", settings);
    window.addEventListener("dailymark-reminder-error", reminder);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("dailymark-settings-error", settings);
      window.removeEventListener("dailymark-reminder-error", reminder);
    };
  }, []);
  if (!offline && !message) return null;
  return (
    <div
      role="status"
      className="app-container rounded-xl bg-danger-soft p-3 text-sm text-danger"
    >
      {offline
        ? "You’re offline. Keep unsaved writing open until you reconnect."
        : message}
      {!offline && (
        <button className="ml-3 underline" onClick={() => setMessage("")}>
          Dismiss
        </button>
      )}
    </div>
  );
}
