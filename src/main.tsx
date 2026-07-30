import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { SpeechProvider } from "./context/SpeechContext";
import App from "./App";
import "./index.css";

// NotesProvider now lives inside App, behind the auth guard, so it never
// queries without a session. SpeechProvider sits above the router instead:
// playback should survive navigating from one note to the next.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <SpeechProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </SpeechProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
