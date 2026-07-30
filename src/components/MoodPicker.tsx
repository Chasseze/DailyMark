import { NOTES_MOODS } from "../lib/moods";
import { useMood } from "../context/mood-context";

/** Compact mood switcher so the three palette directions can be compared live. */
export default function MoodPicker() {
  const { mood, setMood } = useMood();

  return (
    <div
      className="flex items-center gap-1 rounded-full bg-black/15 p-1"
      role="group"
      aria-label="Notes mood"
    >
      {NOTES_MOODS.map((option) => {
        const active = mood === option.id;
        return (
          <button
            key={option.id}
            type="button"
            title={`${option.label}: ${option.blurb}`}
            aria-pressed={active}
            onClick={() => setMood(option.id)}
            className={
              "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-all " +
              (active
                ? "bg-white text-[color:var(--mood-masthead)] shadow-sm"
                : "text-white/80 hover:bg-white/10 hover:text-white")
            }
          >
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ring-1 ring-white/40"
              style={{ backgroundColor: option.swatch }}
              aria-hidden="true"
            />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
