import { Component, type ReactNode } from "react";
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="app-shell min-h-screen p-8 text-ink">
        <h1>DailyMark could not display this screen</h1>
        <p className="my-4">
          Reload to try again. If you enabled draft recovery, your recovery
          copies will be offered when you reopen the note.
        </p>
        <button onClick={() => window.location.reload()}>
          Reload DailyMark
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
