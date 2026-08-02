-- Curated Thoughts: shared read-only stories/articles with source attribution.
-- Clients never write these rows; content is seeded here (or inserted via SQL Editor).

create table if not exists public.thoughts (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 200),
  content      text not null default '',
  preview      text not null default '',
  author       text not null default '',
  source_name  text not null default '',
  source_url   text not null default '',
  tags         text[] not null default '{}',
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists thoughts_published_idx
  on public.thoughts (published_at desc);

alter table public.thoughts enable row level security;

drop policy if exists "thoughts: select authenticated" on public.thoughts;
create policy "thoughts: select authenticated" on public.thoughts
  for select to authenticated using (true);

-- Keep preview in sync the same way notes do (plain opening snippet).
create or replace function public.thoughts_set_preview()
returns trigger
language plpgsql
as $$
declare
  plain text;
begin
  plain := coalesce(new.content, '');
  plain := regexp_replace(plain, E'[*_`#>\\[\\]()!\\\\]', '', 'g');
  plain := regexp_replace(plain, E'\\s+', ' ', 'g');
  plain := trim(both from plain);
  new.preview := left(plain, 320);
  return new;
end;
$$;

drop trigger if exists thoughts_preview_biu on public.thoughts;
create trigger thoughts_preview_biu
  before insert or update of content on public.thoughts
  for each row
  execute function public.thoughts_set_preview();

-- Starter curated pieces. Bodies are original DailyMark summaries for reflection —
-- not reprints of the source articles. Attribution lives in the metadata columns.
insert into public.thoughts (id, title, content, author, source_name, source_url, tags, published_at)
values
(
  'a1111111-1111-4111-8111-111111111101',
  'Make it obvious, then make it easy',
  $md$Habit change rarely fails for lack of motivation. It fails because the environment still makes the old path frictionless.

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

Small stage, clearer play.
$md$,
  'James Clear',
  'Atomic Habits',
  'https://jamesclear.com/atomic-habits',
  array['habits', 'focus'],
  '2026-07-20T10:00:00Z'
),
(
  'a1111111-1111-4111-8111-111111111102',
  'Deep work is a scarce luxury',
  $md$Attention is the new factory floor. The people who can protect long, uninterrupted stretches of concentration will compound faster than those who only answer what pings.

Deep work is not hustle theatre. It is:

- Choosing one hard problem
- Closing the tab farm
- Giving the mind enough quiet to form original thought

Shallow work will always expand to fill the calendar. Deep work has to be scheduled like a meeting with someone you respect — because that someone is future you.

### A practical frame
Block 90 minutes. Name the outcome. Silence notifications. End with a written next step so tomorrow does not start from fog.
$md$,
  'Cal Newport',
  'Deep Work',
  'https://calnewport.com/deep-work-rules-for-focused-success-in-a-distracted-world/',
  array['focus', 'craft'],
  '2026-07-22T10:00:00Z'
),
(
  'a1111111-1111-4111-8111-111111111103',
  'Start before you feel ready',
  $md$Waiting to feel confident is often waiting forever. Confidence is usually the residue of evidence, and evidence only appears after imperfect attempts.

The useful question is not “Am I ready?” It is “What is the smallest public version of this I can ship this week?”

Creators who look overnight usually spent years in quiet drafts. The difference is they kept putting unfinished work where feedback could find it.

### Keep in mind
- Embarrassment is cheaper than invisibility.
- Iteration beats intention.
- Audience is built by showing up, not by announcing a masterpiece.
$md$,
  'Austin Kleon',
  'Show Your Work!',
  'https://austinkleon.com/show-your-work/',
  array['creativity', 'courage'],
  '2026-07-24T10:00:00Z'
),
(
  'a1111111-1111-4111-8111-111111111104',
  'Compounding beats intensity',
  $md$Spectacular effort is impressive. Sustained effort is transformative.

A 1% improvement is almost invisible on Tuesday. Over a year it rewrites the baseline. That is why boring systems outperform dramatic resolutions: they survive ordinary days.

When progress feels flat, check the process — not your worth.

### Questions that help
- What can I repeat when I am tired?
- What will I still respect in six months?
- What metric moves even on a bad week?

Consistency is not glamorous. It is how quiet people become hard to catch.
$md$,
  'Darren Hardy',
  'The Compound Effect',
  'https://www.thecompoundeffect.com/',
  array['growth', 'discipline'],
  '2026-07-26T10:00:00Z'
),
(
  'a1111111-1111-4111-8111-111111111105',
  'Write to think, not only to publish',
  $md$A blank page is a thinking tool. When ideas stay only in your head, they feel clearer than they are. Writing forces the joints of an argument to show.

You do not need a blog to benefit. A private note that asks:

- What am I actually trying to say?
- What would convince a skeptical friend?
- What am I avoiding because it is fuzzy?

…will sharpen judgment faster than another hour of scrolling summaries.

Capture the spark. Shape it later. The point of Thoughts is not to collect links — it is to keep company with ideas long enough that they change how you act.
$md$,
  'Tiago Forte',
  'Building a Second Brain',
  'https://www.buildingasecondbrain.com/',
  array['writing', 'learning'],
  '2026-07-28T10:00:00Z'
),
(
  'a1111111-1111-4111-8111-111111111106',
  'Protect the morning for what matters',
  $md$Most days are decided before lunch. If the first open hour is spent on other people’s urgency, your own work inherits the leftovers.

A gentle defense:

1. Decide tonight what tomorrow’s first block is for.
2. Keep that block offline if you can.
3. Only then open the inbox.

This is not about becoming unreachable. It is about choosing whose priorities set your tempo.

The world will still be there at 10:30. Your clearest thinking might not.
$md$,
  'Hal Elrod',
  'The Miracle Morning',
  'https://www.miraclemorning.com/',
  array['routines', 'energy'],
  '2026-07-30T10:00:00Z'
)
on conflict (id) do nothing;
