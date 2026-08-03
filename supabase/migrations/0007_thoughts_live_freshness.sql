-- Restage starter Thoughts onto a 2-day drop cadence so Live Feed shows
-- fresh pieces (≤ 3 days old) instead of a shuffled evergreen catalog.
-- Bookmarks still keep older pieces in Saved after they leave Live.

with ordered as (
  select
    id,
    row_number() over (order by published_at asc, id asc) - 1 as idx,
    count(*) over () as total
  from public.thoughts
)
update public.thoughts t
set published_at =
  date_trunc('day', timezone('utc', now()))
  + interval '10 hours'
  - ((o.total - 1 - o.idx) * interval '2 days')
from ordered o
where t.id = o.id;
