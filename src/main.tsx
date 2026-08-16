import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { PrefsProvider } from "./context/PrefsContext";
import { ThemeProvider } from "./context/ThemeContext";
import { MoodProvider } from "./context/MoodContext";
import { SpeechProvider } from "./context/SpeechContext";
import { startReminderLoop } from "./lib/reminders";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PrefsProvider>
          <ThemeProvider>
            <MoodProvider>
              <SpeechProvider>
                <App />
              </SpeechProvider>
            </MoodProvider>
          </ThemeProvider>
        </PrefsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

startReminderLoop();

function syncPageHidden() {
  document.documentElement.classList.toggle("page-hidden", document.hidden);
}
syncPageHidden();
document.addEventListener("visibilitychange", syncPageHidden);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is optional — the app works fine without a SW.
    });
  });
}
