import { Link } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * Shell for the public legal pages.
 *
 * These sit outside RequireAuth: someone deciding whether to create an account
 * has to be able to read them, and a link handed to them must not bounce to a
 * sign-in screen.
 */
export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  /** Human-readable date this document last changed. */
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="app-shell min-h-screen w-full text-ink">
      <div className="app-container legal">
        <header className="legal__head">
          <Link to="/" className="legal__back">
            ← DailyMark
          </Link>
          <h1 className="page-title mt-3 text-ink">{title}</h1>
          <p className="legal__updated">Last updated {updated}</p>
        </header>

        <div className="legal__body">{children}</div>

        <footer className="legal__foot">
          <Link to="/privacy" className="legal__link">
            Privacy Notice
          </Link>
          <span aria-hidden="true"> · </span>
          <Link to="/terms" className="legal__link">
            Terms of Use
          </Link>
        </footer>
      </div>
    </div>
  );
}

/** Marks a clause that still needs a real value before anyone relies on it. */
export function Todo({ children }: { children: ReactNode }) {
  return <mark className="legal__todo">{children}</mark>;
}
