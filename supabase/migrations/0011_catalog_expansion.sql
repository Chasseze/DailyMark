-- Catalog expansion: deepens the pool the daily-drop job (0010) draws from.
--
-- With only 6 rows per tab, promoting 3/day against a 2-day live window meant
-- every piece reappeared every 2 days. This takes each catalog to 18 rows, so
-- nothing repeats for ~6 days. The pool is the content lever: insert more rows
-- and the cycle lengthens automatically — no code change needed.
--
-- New rows are dated in the past so they sit in the pool (not live) and get
-- promoted, oldest-first, by promote_daily_drops() over the coming days.
--
-- Thought bodies are original DailyMark summaries written for reflection, not
-- reprints of the sources; attribution lives in the metadata columns.
-- Every visual is a Wikimedia Commons file whose existence, creator and
-- licence were verified against the Commons API before being written here,
-- and `image_url` is a width-capped (compressed) rendition, never the
-- full-resolution original.

-- ─── Thoughts ────────────────────────────────────────────────────────────────

insert into public.thoughts (id, title, content, author, source_name, source_url, tags, collection, published_at)
values
('a1111111-1111-4111-8111-111111111107', 'The map is not the territory',
 $md$Every model you hold — of your job, your health, another person — is a simplification. That is what makes it useful, and also what makes it wrong at the edges.

Trouble starts when the map gets defended as if it were the ground. The useful habit is to keep asking: what would I expect to see if this picture were accurate, and have I actually looked?

### Try this
- Name one belief you have not tested in a year.
- Ask what evidence would change it.
- Go looking for that evidence on purpose.$md$,
 'Alfred Korzybski', 'General semantics', 'https://www.generalsemantics.org/',
 array['thinking', 'clarity'], 'Thinking', '2025-01-01T00:00:00Z'),

('a1111111-1111-4111-8111-111111111108', 'Some things gain from disorder',
 $md$Fragile things break under stress. Resilient things resist it. But a third category actually improves because of it — muscles, immune systems, good arguments.

The practical question stops being "how do I avoid shocks?" and becomes "how do I arrange things so small shocks make me stronger instead of ending me?" Usually the answer is: many small bets, none of them fatal.

### Keep in mind
- Avoid ruin first; optimise second.
- Prefer many small failures to one large one.
- Comfort that never tests you quietly weakens you.$md$,
 'Nassim Nicholas Taleb', 'Antifragile', 'https://www.fooledbyrandomness.com/',
 array['risk', 'resilience'], 'Thinking', '2025-01-01T01:00:00Z'),

('a1111111-1111-4111-8111-111111111109', 'The state where the work does itself',
 $md$There is a narrow band where a task is hard enough to demand everything you have, but not so hard that you flounder. Inside it, self-consciousness disappears and time stops behaving normally.

You cannot force it, but you can set the table for it: a clear goal, immediate feedback, and difficulty tuned just past your current skill. Then remove the interruptions that keep yanking you back out.

### Setting the table
- Know exactly what "done" looks like before you start.
- Pick something slightly beyond comfortable.
- Protect the first twenty minutes — that is the entry fee.$md$,
 'Mihaly Csikszentmihalyi', 'Flow', 'https://www.pursuit-of-happiness.org/history-of-happiness/mihaly-csikszentmihalyi/',
 array['focus', 'craft'], 'Focus', '2025-01-01T02:00:00Z'),

('a1111111-1111-4111-8111-111111111110', 'Talent is a starting point, not a verdict',
 $md$Treat ability as fixed and every difficulty becomes evidence about your worth — so you avoid difficulty. Treat it as trainable and the same difficulty becomes information about method.

The tell is how you talk to yourself after failing. "I am not a numbers person" closes a door. "I have not learned this yet" leaves it open.

### Worth noticing
- Praise effort and strategy, not cleverness.
- "Yet" is doing a lot of work in that sentence.
- Struggle is often the feeling of learning, not of failing.$md$,
 'Carol Dweck', 'Mindset', 'https://www.mindsetworks.com/',
 array['growth', 'learning'], 'Growth', '2025-01-01T03:00:00Z'),

('a1111111-1111-4111-8111-111111111111', 'Two minds, one of them lazy',
 $md$One system is fast, intuitive and confident. The other is slow, effortful and easily tired. Most of the day the fast one drives, and the slow one signs off on whatever it is handed.

That arrangement is efficient and mostly fine — until the question is one where intuition has no business having an opinion. The skill is recognising those moments and deliberately slowing down.

### Slow-down triggers
- The answer arrived instantly and feels obvious.
- The stakes are high and reversible only at cost.
- You are tired, rushed, or being agreed with too easily.$md$,
 'Daniel Kahneman', 'Thinking, Fast and Slow', 'https://danielkahneman.com/',
 array['thinking', 'decisions'], 'Thinking', '2025-01-01T04:00:00Z'),

('a1111111-1111-4111-8111-111111111112', 'The disciplined pursuit of less',
 $md$Saying yes to everything is not generosity, it is a decision to let other people set your priorities. The alternative is not doing less work — it is doing less of the wrong work.

Essentialism asks a harsh, clarifying question of every commitment: if I were not already doing this, would I sign up for it today? If the answer is no, that is the answer.

### A practical filter
- If it is not a clear yes, it is a no.
- Protect one priority per day, not seven.
- The cost of a yes is always some other yes you can no longer give.$md$,
 'Greg McKeown', 'Essentialism', 'https://gregmckeown.com/',
 array['focus', 'priorities'], 'Focus', '2025-01-01T05:00:00Z'),

('a1111111-1111-4111-8111-111111111113', 'Resistance is the work talking',
 $md$The urge to reorganise your desk, check one more source, or start tomorrow instead is not laziness. It is a predictable force that shows up in exact proportion to how much a piece of work matters to you.

Which makes it a compass. Whatever you are avoiding hardest is usually the thing worth doing. Professionals do not wait for it to lift; they sit down anyway and let it complain.

### On showing up
- Amateurs wait for inspiration; professionals keep hours.
- Start before you feel like it — the feeling follows.
- The fear is a signal you are near something real.$md$,
 'Steven Pressfield', 'The War of Art', 'https://stevenpressfield.com/',
 array['creativity', 'discipline'], 'Creativity', '2025-01-01T06:00:00Z'),

('a1111111-1111-4111-8111-111111111114', 'The last of the human freedoms',
 $md$Frankl survived what almost nobody survives, and came out arguing that meaning is not something life owes you — it is something you supply, especially where circumstances are not yours to choose.

Between what happens and how you answer it there is a space. It can be very small. It is never zero, and how you use it is the part that stays yours.

### The reframe
- Stop asking what you expect from life; ask what it is asking of you.
- Suffering without meaning crushes; suffering with meaning can be carried.
- Purpose is usually found in work, in love, or in courage under hardship.$md$,
 'Viktor E. Frankl', 'Man''s Search for Meaning', 'https://www.viktorfrankl.org/',
 array['meaning', 'resilience'], 'Meaning', '2025-01-01T07:00:00Z'),

('a1111111-1111-4111-8111-111111111115', 'Passion plus perseverance, over years',
 $md$What separates people who finish hard things is rarely raw ability. It is the willingness to stay interested in one direction long enough for compounding to do its work.

Grit is not white-knuckling through misery. It is holding a long-term goal steady while cheerfully changing tactics — and finding the thing worth being stubborn about in the first place.

### Staying power
- Depth beats novelty once you have chosen.
- Difficulty is expected, not a signal to quit.
- Interest is cultivated, not discovered fully formed.$md$,
 'Angela Duckworth', 'Grit', 'https://angeladuckworth.com/',
 array['discipline', 'growth'], 'Growth', '2025-01-01T08:00:00Z'),

('a1111111-1111-4111-8111-111111111116', 'Generalists win the long game',
 $md$Early specialisation looks efficient and often is — in kind environments where the rules hold still. In everything else, the people who sampled widely before committing tend to outperform the ones who started at four.

Breadth is what lets you notice that a problem in your field has already been solved somewhere else. That transfer is hard to teach and easy to underrate.

### Worth trying
- Take the detour; it is training, not delay.
- Read one field away from your own.
- Match-quality beats a head start.$md$,
 'David Epstein', 'Range', 'https://davidepstein.com/',
 array['learning', 'career'], 'Learning', '2025-01-01T09:00:00Z'),

('a1111111-1111-4111-8111-111111111117', 'You get about four thousand weeks',
 $md$Productivity advice usually promises that if you get efficient enough, you will finally get on top of everything. You will not. The inbox refills, the list regenerates, and the finish line moves.

Accepting the limit is not defeat — it is what makes choosing possible. A finite life means every yes is a real trade, and that is precisely what gives any of it weight.

### The shift
- Stop trying to clear the decks; decide what deserves the time.
- Neglect the right things on purpose.
- Being unable to do everything is the condition, not a bug to fix.$md$,
 'Oliver Burkeman', 'Four Thousand Weeks', 'https://www.oliverburkeman.com/',
 array['time', 'meaning'], 'Meaning', '2025-01-01T10:00:00Z'),

('a1111111-1111-4111-8111-111111111118', 'Ship the work, trust the practice',
 $md$Waiting for certainty that the work is good is a way of never handing it over. The alternative is to commit to a practice — a rhythm of making and shipping — and let quality emerge from repetition rather than from anxiety.

Outcomes are partly luck. The process is entirely yours. Judge yourself on the part you control, and keep putting the work where it can meet someone.

### The practice
- Ship on a schedule, not on a feeling.
- Make it for someone specific, not for everyone.
- Detach from the reception; stay attached to the craft.$md$,
 'Seth Godin', 'The Practice', 'https://seths.blog/',
 array['creativity', 'craft'], 'Creativity', '2025-01-01T11:00:00Z')
on conflict (id) do nothing;

-- ─── Visuals ─────────────────────────────────────────────────────────────────

insert into public.visuals
  (id, title, image_url, alt_text, content, author, source_name, source_url, license, tags, collection, published_at)
values
('b2222222-2222-4222-8222-222222222207', 'Everything you know, on a single pixel',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Pale_Blue_Dot.png?width=1600',
 'A grainy band of scattered sunlight with Earth appearing as a tiny pale point within it.',
 $md$In 1990, on its way out of the solar system, Voyager 1 turned around and photographed home from about six billion kilometres away. Earth takes up less than a pixel — the small bright speck caught in a band of scattered sunlight.

Carl Sagan pushed for the picture knowing it had no scientific value. Its value was the other kind: every war, every ambition, everyone you have ever loved, all of it on that dot.$md$,
 'Voyager 1', 'NASA / JPL', 'https://commons.wikimedia.org/wiki/File:Pale_Blue_Dot.png',
 'Public domain (NASA)', array['space', 'perspective'], 'Space', '2025-01-01T00:00:00Z'),

('b2222222-2222-4222-8222-222222222208', 'Ten thousand galaxies in an empty patch of sky',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Hubble_ultra_deep_field.jpg?width=1600',
 'A dark field densely scattered with galaxies of many shapes and colours.',
 $md$Astronomers pointed Hubble at a patch of sky that looked like nothing — a spot roughly the size of a grain of sand held at arm''s length — and left the shutter open for days.

Almost every smudge here is an entire galaxy, some of them close to the beginning of time. The picture is less a photograph than a core sample drilled through the observable universe.$md$,
 'NASA and the European Space Agency', 'NASA / ESA / Hubble',
 'https://commons.wikimedia.org/wiki/File:Hubble_ultra_deep_field.jpg',
 'Public domain (NASA/ESA)', array['space', 'science'], 'Space', '2025-01-01T01:00:00Z'),

('b2222222-2222-4222-8222-222222222209', 'The smartest room ever photographed',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Solvay_conference_1927.jpg?width=1600',
 'Twenty-nine physicists posed in three rows for a formal group portrait in 1927.',
 $md$Brussels, October 1927. Twenty-nine physicists sat for a group portrait during the Fifth Solvay Conference, where the argument over what quantum mechanics actually *means* came to a head between Einstein and Bohr.

Seventeen of the people in this frame would win a Nobel Prize. Marie Curie, front row, had already won two — in different sciences.$md$,
 'Benjamin Couprie', 'Institut International de Physique Solvay',
 'https://commons.wikimedia.org/wiki/File:Solvay_conference_1927.jpg',
 'Public domain', array['science', 'history'], 'History', '2025-01-01T02:00:00Z'),

('b2222222-2222-4222-8222-222222222210', 'A footprint with no weather to erase it',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Apollo_11_bootprint.jpg?width=1600',
 'A crisp boot impression pressed into fine grey lunar soil.',
 $md$Buzz Aldrin photographed this print in the lunar soil to study how the surface behaved underfoot. It was documentation, not art.

There is no wind on the Moon and no rain. Barring a stray micrometeorite, this shape will outlast every building on Earth — a piece of ordinary engineering paperwork that became one of the longest-lived objects humans have ever made.$md$,
 'NASA / Buzz Aldrin', 'NASA / Apollo 11',
 'https://commons.wikimedia.org/wiki/File:Apollo_11_bootprint.jpg',
 'Public domain (NASA)', array['space', 'history'], 'Space', '2025-01-01T03:00:00Z'),

('b2222222-2222-4222-8222-222222222211', 'Saturn, lit from behind',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Saturn_during_Equinox.jpg?width=1600',
 'Saturn with its rings seen nearly edge-on, casting long shadows during its equinox.',
 $md$Cassini caught Saturn at equinox, a moment that arrives once every fifteen years, when sunlight strikes the rings exactly edge-on.

At that angle anything sticking up out of the ring plane throws a long shadow — which is how we learned the rings are not the smooth sheet they appear to be, but a landscape with structures kilometres tall.$md$,
 'NASA / JPL / Space Science Institute', 'NASA / Cassini',
 'https://commons.wikimedia.org/wiki/File:Saturn_during_Equinox.jpg',
 'Public domain (NASA)', array['space', 'science'], 'Space', '2025-01-01T04:00:00Z'),

('b2222222-2222-4222-8222-222222222212', 'The wave that is not a tsunami',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Tsunami_by_hokusai_19th_century.jpg?width=1600',
 'A large cresting wave with clawed foam towering over boats, with Mount Fuji small in the distance.',
 $md$Hokusai was around seventy when he made this print, part of a series obsessed with Mount Fuji from every possible angle. Fuji is here — small, still, framed by the trough of the wave.

Despite its English name it depicts a rogue swell, not a tsunami. Look closely and you find the boats and the rowers braced inside it: the drama is not the water alone, it is people inside the water.$md$,
 'Katsushika Hokusai', 'Thirty-six Views of Mount Fuji',
 'https://commons.wikimedia.org/wiki/File:Tsunami_by_hokusai_19th_century.jpg',
 'Public domain', array['art', 'history'], 'Art', '2025-01-01T05:00:00Z'),

('b2222222-2222-4222-8222-222222222213', 'A man with his back to us',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg?width=1600',
 'A figure in a dark coat stands on a rocky peak looking out over a sea of fog and distant mountains.',
 $md$Friedrich painted the figure from behind — a device that quietly hands you his position. You are not looking at a man; you are looking at what he is looking at.

It became the visual shorthand for Romanticism: the individual set against something vast and not entirely knowable, standing on solid rock while everything beyond dissolves into weather.$md$,
 'Caspar David Friedrich', 'Kunsthalle Hamburg',
 'https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg',
 'Public domain', array['art', 'history'], 'Art', '2025-01-01T06:00:00Z'),

('b2222222-2222-4222-8222-222222222214', 'Earth, assembled from thousands of passes',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Blue_Marble_Western_Hemisphere.jpg?width=1600',
 'A composite true-colour view of Earth showing the Americas under swirling cloud.',
 $md$This one was not taken in a single click. It is a composite, stitched from months of satellite passes into a cloud-free true-colour mosaic and then wrapped back onto a sphere.

That makes it a portrait of a planet nobody has ever actually seen from a window — an honest image assembled from an enormous number of honest measurements.$md$,
 'NASA images by Reto Stöckli', 'NASA Earth Observatory',
 'https://commons.wikimedia.org/wiki/File:Blue_Marble_Western_Hemisphere.jpg',
 'Public domain (NASA)', array['earth', 'science'], 'Space', '2025-01-01T07:00:00Z'),

('b2222222-2222-4222-8222-222222222215', 'A view from a room he could not leave',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg?width=1600',
 'A swirling night sky over a sleeping village, with a dark cypress rising in the foreground.',
 $md$Van Gogh painted this from a room in the asylum at Saint-Rémy, working from memory and an east-facing window, before sunrise.

The village below is partly invented; the sky is doing something no sky does. He thought it a failure. It has since become one of the most recognised images on the planet — painted by someone who could not sell it.$md$,
 'Vincent van Gogh', 'Museum of Modern Art',
 'https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
 'Public domain', array['art', 'history'], 'Art', '2025-01-01T08:00:00Z'),

('b2222222-2222-4222-8222-222222222216', 'The most looked-at face in the world',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg?width=1600',
 'A seated woman with a faint smile before a hazy winding landscape.',
 $md$Leonardo carried this panel around for years and never quite handed it over. The softness at the mouth and eyes comes from sfumato — glazes built up so thinly that no edge is ever committed to.

That indecision is the trick: the expression is never resolved, so your eye keeps returning to check. A theft in 1911 did the rest, turning a well-regarded portrait into a global celebrity.$md$,
 'Leonardo da Vinci', 'Musée du Louvre',
 'https://commons.wikimedia.org/wiki/File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg',
 'Public domain', array['art', 'history'], 'Art', '2025-01-01T09:00:00Z'),

('b2222222-2222-4222-8222-222222222217', 'The southern lights, seen from above',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Aurora_Australis_From_ISS.JPG?width=1600',
 'A green band of aurora glowing above the curve of Earth, photographed from orbit.',
 $md$From the ground an aurora is a light in the sky. From the International Space Station it is clearly a structure — a curtain standing up off the planet, wrapped around the magnetic pole.

What you are watching is charged particles from the Sun hitting the upper atmosphere and losing an argument with Earth''s magnetic field. The green is oxygen, roughly a hundred kilometres up.$md$,
 'ISS Expedition 23 crew', 'NASA',
 'https://commons.wikimedia.org/wiki/File:Aurora_Australis_From_ISS.JPG',
 'Public domain (NASA)', array['space', 'nature'], 'Nature', '2025-01-01T10:00:00Z'),

('b2222222-2222-4222-8222-222222222218', 'Six million years of water, patiently',
 'https://commons.wikimedia.org/wiki/Special:FilePath/Grand_Canyon_view_from_Pima_Point_2010.jpg?width=1600',
 'Layered red rock ridges of the Grand Canyon receding into haze under a wide sky.',
 $md$Every band of colour in this wall is a different era, stacked in order, with the oldest rock at the bottom close to two billion years old.

The Colorado River did not carve this by force. It carved it by not stopping. There is no better argument anywhere on Earth for what small, relentless, boring persistence adds up to.$md$,
 'Chensiyuan', 'Wikimedia Commons',
 'https://commons.wikimedia.org/wiki/File:Grand_Canyon_view_from_Pima_Point_2010.jpg',
 'CC BY-SA 4.0 — Chensiyuan', array['nature', 'earth'], 'Nature', '2025-01-01T11:00:00Z')
on conflict (id) do nothing;
