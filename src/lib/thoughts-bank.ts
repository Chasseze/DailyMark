import type { Thought } from "./types";

/**
 * Bundled fallback when the `thoughts` table is empty or unreachable.
 * Bodies are original DailyMark summaries — not reprints of the sources.
 */
export const THOUGHTS_BANK: Thought[] = [
  {
    id: "a1111111-1111-4111-8111-111111111101",
    title: "Make it obvious, then make it easy",
    content: `Habit change rarely fails for lack of motivation. It fails because the environment still makes the old path frictionless.

A useful sequence:

1. **Cue** — put the trigger where your eyes already go.
2. **Craving** — attach the habit to something you already want.
3. **Response** — shrink the first step until it feels almost silly.
4. **Reward** — close the loop so your brain wants the next round.

You do not need a reinvention of character. You need a redesign of the room you walk through every day.

### Try this
- Place the book on the pillow, not the shelf.
- Put the running shoes by the door the night before.
- Keep the phone charger outside the bedroom.

Small stage, clearer play.`,
    preview:
      "Habit change rarely fails for lack of motivation. It fails because the environment still makes the old path frictionless.",
    author: "James Clear",
    source_name: "Atomic Habits",
    source_url: "https://jamesclear.com/atomic-habits",
    collection: "Habits",
    tags: ["habits", "focus"],
    published_at: "2026-07-20T10:00:00Z",
    created_at: "2026-07-20T10:00:00Z",
  },
  {
    id: "a1111111-1111-4111-8111-111111111102",
    title: "Deep work is a scarce luxury",
    content: `Attention is the new factory floor. The people who can protect long, uninterrupted stretches of concentration will compound faster than those who only answer what pings.

Deep work is not hustle theatre. It is:

- Choosing one hard problem
- Closing the tab farm
- Giving the mind enough quiet to form original thought

Shallow work will always expand to fill the calendar. Deep work has to be scheduled like a meeting with someone you respect — because that someone is future you.

### A practical frame
Block 90 minutes. Name the outcome. Silence notifications. End with a written next step so tomorrow does not start from fog.`,
    preview:
      "Attention is the new factory floor. The people who can protect long, uninterrupted stretches of concentration will compound faster than those who only answer what pings.",
    author: "Cal Newport",
    source_name: "Deep Work",
    source_url: "https://calnewport.com/deep-work-rules-for-focused-success-in-a-distracted-world/",
    collection: "Focus",
    tags: ["focus", "craft"],
    published_at: "2026-07-22T10:00:00Z",
    created_at: "2026-07-22T10:00:00Z",
  },
  {
    id: "a1111111-1111-4111-8111-111111111103",
    title: "Start before you feel ready",
    content: `Waiting to feel confident is often waiting forever. Confidence is usually the residue of evidence, and evidence only appears after imperfect attempts.

The useful question is not “Am I ready?” It is “What is the smallest public version of this I can ship this week?”

Creators who look overnight usually spent years in quiet drafts. The difference is they kept putting unfinished work where feedback could find it.

### Keep in mind
- Embarrassment is cheaper than invisibility.
- Iteration beats intention.
- Audience is built by showing up, not by announcing a masterpiece.`,
    preview:
      "Waiting to feel confident is often waiting forever. Confidence is usually the residue of evidence, and evidence only appears after imperfect attempts.",
    author: "Austin Kleon",
    source_name: "Show Your Work!",
    source_url: "https://austinkleon.com/show-your-work/",
    collection: "Creativity",
    tags: ["creativity", "courage"],
    published_at: "2026-07-24T10:00:00Z",
    created_at: "2026-07-24T10:00:00Z",
  },
  {
    id: "a1111111-1111-4111-8111-111111111104",
    title: "Compounding beats intensity",
    content: `Spectacular effort is impressive. Sustained effort is transformative.

A 1% improvement is almost invisible on Tuesday. Over a year it rewrites the baseline. That is why boring systems outperform dramatic resolutions: they survive ordinary days.

When progress feels flat, check the process — not your worth.

### Questions that help
- What can I repeat when I am tired?
- What will I still respect in six months?
- What metric moves even on a bad week?

Consistency is not glamorous. It is how quiet people become hard to catch.`,
    preview:
      "Spectacular effort is impressive. Sustained effort is transformative.",
    author: "Darren Hardy",
    source_name: "The Compound Effect",
    source_url: "https://www.thecompoundeffect.com/",
    collection: "Growth",
    tags: ["growth", "discipline"],
    published_at: "2026-07-26T10:00:00Z",
    created_at: "2026-07-26T10:00:00Z",
  },
  {
    id: "a1111111-1111-4111-8111-111111111105",
    title: "Write to think, not only to publish",
    content: `A blank page is a thinking tool. When ideas stay only in your head, they feel clearer than they are. Writing forces the joints of an argument to show.

You do not need a blog to benefit. A private note that asks:

- What am I actually trying to say?
- What would convince a skeptical friend?
- What am I avoiding because it is fuzzy?

…will sharpen judgment faster than another hour of scrolling summaries.

Capture the spark. Shape it later. The point of Thoughts is not to collect links — it is to keep company with ideas long enough that they change how you act.`,
    preview:
      "A blank page is a thinking tool. When ideas stay only in your head, they feel clearer than they are.",
    author: "Tiago Forte",
    source_name: "Building a Second Brain",
    source_url: "https://www.buildingasecondbrain.com/",
    collection: "Writing",
    tags: ["writing", "learning"],
    published_at: "2026-07-28T10:00:00Z",
    created_at: "2026-07-28T10:00:00Z",
  },
  {
    id: "a1111111-1111-4111-8111-111111111106",
    title: "Protect the morning for what matters",
    content: `Most days are decided before lunch. If the first open hour is spent on other people’s urgency, your own work inherits the leftovers.

A gentle defense:

1. Decide tonight what tomorrow’s first block is for.
2. Keep that block offline if you can.
3. Only then open the inbox.

This is not about becoming unreachable. It is about choosing whose priorities set your tempo.

The world will still be there at 10:30. Your clearest thinking might not.`,
    preview:
      "Most days are decided before lunch. If the first open hour is spent on other people’s urgency, your own work inherits the leftovers.",
    author: "Hal Elrod",
    source_name: "The Miracle Morning",
    source_url: "https://www.miraclemorning.com/",
    collection: "Routines",
    tags: ["routines", "energy"],
    published_at: "2026-07-30T10:00:00Z",
    created_at: "2026-07-30T10:00:00Z",
  },
];
