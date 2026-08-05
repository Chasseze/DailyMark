-- Curated Visuals: shared read-only picture stories with source attribution.
-- Same shape as public.thoughts (0004_thoughts.sql) but for images instead of
-- prose. Clients never write these rows; content is seeded here (or inserted
-- via SQL Editor).
--
-- `image_url` must always point at a compressed rendition, never an original
-- upload — for these starter rows that means a Wikimedia Commons thumbnail
-- (its `Special:FilePath` service re-encodes to a width-capped JPEG), the
-- same 1600px-longest-edge ceiling `compressNoteImage` applies to note
-- attachments (see src/lib/note-images.ts).

create table if not exists public.visuals (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 200),
  image_url    text not null,
  alt_text     text not null default '',
  content      text not null default '',
  preview      text not null default '',
  author       text not null default '',
  source_name  text not null default '',
  source_url   text not null default '',
  -- e.g. "Public domain (NASA)" or "CC BY-SA 4.0 — Jane Doe".
  license      text not null default '',
  tags         text[] not null default '{}',
  collection   text not null default '',
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists visuals_published_idx
  on public.visuals (published_at desc);

alter table public.visuals enable row level security;

drop policy if exists "visuals: select authenticated" on public.visuals;
create policy "visuals: select authenticated" on public.visuals
  for select to authenticated using (true);

-- Keep preview in sync the same way thoughts does (plain opening snippet).
create or replace function public.visuals_set_preview()
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

drop trigger if exists visuals_preview_biu on public.visuals;
create trigger visuals_preview_biu
  before insert or update of content on public.visuals
  for each row
  execute function public.visuals_set_preview();

-- Starter curated picture stories. Captions are original DailyMark write-ups
-- for reflection — not reprints of the source pages. Every row carries a
-- named creator, a source link, and a license/credit line so attribution is
-- never optional. Sourced from Wikimedia Commons; `image_url` is a
-- width-capped (compressed) thumbnail rendition of the original file, not
-- the full-resolution upload.
insert into public.visuals
  (id, title, image_url, alt_text, content, author, source_name, source_url, license, tags, collection, published_at)
values
(
  'b2222222-2222-4222-8222-222222222201',
  'Earth, from the far side of the Moon',
  'https://commons.wikimedia.org/wiki/Special:FilePath/NASA-Apollo8-Dec24-Earthrise.jpg?width=1600',
  'Earth rising above the grey lunar horizon, photographed from Apollo 8 in December 1968.',
  $md$On Christmas Eve 1968, Apollo 8 came around the far side of the Moon on its fourth orbit and the crew saw something no human had framed in a viewfinder before: their own planet, small and blue, clearing a grey horizon.

Bill Anders grabbed a camera loaded with color film and shot it almost on reflex. The picture reordered how a lot of people thought about home — a single, fragile arrangement of blue and white, with nowhere else to stand and look back from.$md$,
  'Bill Anders',
  'NASA / Apollo 8',
  'https://commons.wikimedia.org/wiki/File:NASA-Apollo8-Dec24-Earthrise.jpg',
  'Public domain (NASA)',
  array['space', 'history'],
  'Space',
  '2026-07-21T09:00:00Z'
),
(
  'b2222222-2222-4222-8222-222222222202',
  'A portrait that put a face on the Depression',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Lange-MigrantMother02.jpg?width=1600',
  'Florence Owens Thompson, seated with two of her children turned away from the camera, at a pea-pickers camp in 1936.',
  $md$Dorothea Lange was driving past a migrant labor camp in Nipomo, California when something told her to turn around. She spent maybe ten minutes with Florence Owens Thompson, a 32-year-old mother of seven whose family had just sold the tires off their car for food.

The picture ran in a San Francisco newspaper days later, aid arrived at the camp, and the image outlived the article — it became the way an entire decade of hardship got remembered.$md$,
  'Dorothea Lange',
  'Farm Security Administration / Library of Congress',
  'https://commons.wikimedia.org/wiki/File:Lange-MigrantMother02.jpg',
  'Public domain (U.S. government work)',
  array['history', 'photojournalism'],
  'Photojournalism',
  '2026-07-22T09:00:00Z'
),
(
  'b2222222-2222-4222-8222-222222222203',
  'Towers of gas and dust, 6,500 light-years out',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Pillars_of_Creation.jpeg?width=1600',
  'Three vast columns of interstellar gas and dust in the Eagle Nebula, lit from within by newborn stars.',
  $md$These columns sit inside the Eagle Nebula, and they are being eaten alive — slowly, by the same young stars whose light lets us see them at all. Dense knots inside the dust are where new stars are still forming; the wispy edges are gas boiling off under starlight from nearby clusters.

Hubble captured this view in 1995 and it became one of the most reproduced astronomical images ever taken — a reminder that "creation" and "erosion" are often the same process, seen at a distance.$md$,
  'NASA, ESA, and the Hubble Heritage Team',
  'NASA / ESA / Hubble Space Telescope',
  'https://commons.wikimedia.org/wiki/File:Pillars_of_Creation.jpeg',
  'Public domain (NASA/ESA)',
  array['space', 'science'],
  'Space',
  '2026-07-23T09:00:00Z'
),
(
  'b2222222-2222-4222-8222-222222222204',
  'The whole Earth, photographed by hand',
  'https://commons.wikimedia.org/wiki/Special:FilePath/The_Blue_Marble.jpg?width=1600',
  'A fully illuminated Earth, showing Africa, Antarctica and the Arabian Peninsula, photographed from Apollo 17.',
  $md$Taken about five hours after launch in December 1972, this is the first photograph of a fully sunlit Earth — the crew had the sun directly behind them, which almost never lines up.

It is also one of the most reproduced photographs in existence. No single person is formally credited; NASA attributes it to the Apollo 17 crew as a whole, one of the few genuinely collective portraits our species has of itself.$md$,
  'Apollo 17 crew',
  'NASA / Apollo 17',
  'https://commons.wikimedia.org/wiki/File:The_Blue_Marble.jpg',
  'Public domain (NASA)',
  array['space', 'earth'],
  'Space',
  '2026-07-24T09:00:00Z'
),
(
  'b2222222-2222-4222-8222-222222222205',
  'A kingfisher, mid-strike',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Alcedo_atthis_-_Riserve_naturali_e_aree_contigue_della_fascia_fluviale_del_Po.jpg?width=1600',
  'A common kingfisher captured mid-dive, wings spread, just above the surface of the Po river.',
  $md$Getting this frame means anticipating a bird that dives at roughly 25 miles an hour and is gone again in under a second. Luca Casale photographed this common kingfisher along Italy's Po river, timing the shutter for the instant of the strike rather than the splash after it.

It won the Wikimedia Commons community vote for Picture of the Year in 2020 — chosen from among tens of thousands of freely licensed photographs submitted that year.$md$,
  'Luca Casale',
  'Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Alcedo_atthis_-_Riserve_naturali_e_aree_contigue_della_fascia_fluviale_del_Po.jpg',
  'CC BY-SA 4.0 — Luca Casale',
  array['nature', 'wildlife'],
  'Nature',
  '2026-07-25T09:00:00Z'
),
(
  'b2222222-2222-4222-8222-222222222206',
  'A doctor''s exhaustion, in one frame',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Covid-19_San_Salvatore_09.jpg?width=1600',
  'A hospital doctor pausing against a wall, mid-shift, at San Salvatore Hospital during the 2020 COVID-19 outbreak in Italy.',
  $md$Alberto Giuliani spent time inside San Salvatore Hospital in Pesaro, Italy, during the first wave of the COVID-19 outbreak in early 2020, photographing staff between patients rather than during any single dramatic moment.

The quiet of this frame is what carried it — no ventilator, no crowd, just a person absorbing a shift that hadn't ended yet. It placed second in Wikimedia Commons' 2020 Picture of the Year vote.$md$,
  'Alberto Giuliani',
  'Wikimedia Commons',
  'https://commons.wikimedia.org/wiki/File:Covid-19_San_Salvatore_09.jpg',
  'CC BY-SA 4.0 — Alberto Giuliani',
  array['photojournalism', 'health'],
  'Photojournalism',
  '2026-07-26T09:00:00Z'
)
on conflict (id) do nothing;
