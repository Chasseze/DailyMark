import type { Visual } from "./types";

/**
 * Bundled fallback when the `visuals` table is empty or unreachable.
 * Mirrors thoughts-bank.ts — captions are original DailyMark write-ups, not
 * reprints of the sources. Published dates are restaged onto the drop
 * cadence at load time (see visuals-context.ts) so the Live feed always has
 * a real freshness window offline.
 *
 * `image_url` always points at a compressed rendition, never an original
 * upload — these use Wikimedia Commons' `Special:FilePath` thumbnail
 * service, capped to the same 1600px longest edge `compressNoteImage` uses
 * for note attachments (see note-images.ts).
 */
export const VISUALS_BANK: Visual[] = [
  {
    id: "b2222222-2222-4222-8222-222222222201",
    title: "Earth, from the far side of the Moon",
    image_url:
      "https://commons.wikimedia.org/wiki/Special:FilePath/NASA-Apollo8-Dec24-Earthrise.jpg?width=1600",
    alt_text:
      "Earth rising above the grey lunar horizon, photographed from Apollo 8 in December 1968.",
    content: `On Christmas Eve 1968, Apollo 8 came around the far side of the Moon on its fourth orbit and the crew saw something no human had framed in a viewfinder before: their own planet, small and blue, clearing a grey horizon.

Bill Anders grabbed a camera loaded with color film and shot it almost on reflex. The picture reordered how a lot of people thought about home — a single, fragile arrangement of blue and white, with nowhere else to stand and look back from.`,
    preview:
      "On Christmas Eve 1968, Apollo 8 came around the far side of the Moon on its fourth orbit and the crew saw something no human had framed in a viewfinder before.",
    author: "Bill Anders",
    source_name: "NASA / Apollo 8",
    source_url: "https://commons.wikimedia.org/wiki/File:NASA-Apollo8-Dec24-Earthrise.jpg",
    license: "Public domain (NASA)",
    tags: ["space", "history"],
    collection: "Space",
    published_at: "2026-07-21T09:00:00Z",
    created_at: "2026-07-21T09:00:00Z",
  },
  {
    id: "b2222222-2222-4222-8222-222222222202",
    title: "A portrait that put a face on the Depression",
    image_url:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Lange-MigrantMother02.jpg?width=1600",
    alt_text:
      "Florence Owens Thompson, seated with two of her children turned away from the camera, at a pea-pickers camp in 1936.",
    content: `Dorothea Lange was driving past a migrant labor camp in Nipomo, California when something told her to turn around. She spent maybe ten minutes with Florence Owens Thompson, a 32-year-old mother of seven whose family had just sold the tires off their car for food.

The picture ran in a San Francisco newspaper days later, aid arrived at the camp, and the image outlived the article — it became the way an entire decade of hardship got remembered.`,
    preview:
      "Dorothea Lange was driving past a migrant labor camp in Nipomo, California when something told her to turn around.",
    author: "Dorothea Lange",
    source_name: "Farm Security Administration / Library of Congress",
    source_url: "https://commons.wikimedia.org/wiki/File:Lange-MigrantMother02.jpg",
    license: "Public domain (U.S. government work)",
    tags: ["history", "photojournalism"],
    collection: "Photojournalism",
    published_at: "2026-07-22T09:00:00Z",
    created_at: "2026-07-22T09:00:00Z",
  },
  {
    id: "b2222222-2222-4222-8222-222222222203",
    title: "Towers of gas and dust, 6,500 light-years out",
    image_url:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Pillars_of_Creation.jpeg?width=1600",
    alt_text:
      "Three vast columns of interstellar gas and dust in the Eagle Nebula, lit from within by newborn stars.",
    content: `These columns sit inside the Eagle Nebula, and they are being eaten alive — slowly, by the same young stars whose light lets us see them at all. Dense knots inside the dust are where new stars are still forming; the wispy edges are gas boiling off under starlight from nearby clusters.

Hubble captured this view in 1995 and it became one of the most reproduced astronomical images ever taken — a reminder that "creation" and "erosion" are often the same process, seen at a distance.`,
    preview:
      "These columns sit inside the Eagle Nebula, and they are being eaten alive — slowly, by the same young stars whose light lets us see them at all.",
    author: "NASA, ESA, and the Hubble Heritage Team",
    source_name: "NASA / ESA / Hubble Space Telescope",
    source_url: "https://commons.wikimedia.org/wiki/File:Pillars_of_Creation.jpeg",
    license: "Public domain (NASA/ESA)",
    tags: ["space", "science"],
    collection: "Space",
    published_at: "2026-07-23T09:00:00Z",
    created_at: "2026-07-23T09:00:00Z",
  },
  {
    id: "b2222222-2222-4222-8222-222222222204",
    title: "The whole Earth, photographed by hand",
    image_url:
      "https://commons.wikimedia.org/wiki/Special:FilePath/The_Blue_Marble.jpg?width=1600",
    alt_text:
      "A fully illuminated Earth, showing Africa, Antarctica and the Arabian Peninsula, photographed from Apollo 17.",
    content: `Taken about five hours after launch in December 1972, this is the first photograph of a fully sunlit Earth — the crew had the sun directly behind them, which almost never lines up.

It is also one of the most reproduced photographs in existence. No single person is formally credited; NASA attributes it to the Apollo 17 crew as a whole, one of the few genuinely collective portraits our species has of itself.`,
    preview:
      "Taken about five hours after launch in December 1972, this is the first photograph of a fully sunlit Earth.",
    author: "Apollo 17 crew",
    source_name: "NASA / Apollo 17",
    source_url: "https://commons.wikimedia.org/wiki/File:The_Blue_Marble.jpg",
    license: "Public domain (NASA)",
    tags: ["space", "earth"],
    collection: "Space",
    published_at: "2026-07-24T09:00:00Z",
    created_at: "2026-07-24T09:00:00Z",
  },
  {
    id: "b2222222-2222-4222-8222-222222222205",
    title: "A kingfisher, mid-strike",
    image_url:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Alcedo_atthis_-_Riserve_naturali_e_aree_contigue_della_fascia_fluviale_del_Po.jpg?width=1600",
    alt_text:
      "A common kingfisher captured mid-dive, wings spread, just above the surface of the Po river.",
    content: `Getting this frame means anticipating a bird that dives at roughly 25 miles an hour and is gone again in under a second. Luca Casale photographed this common kingfisher along Italy's Po river, timing the shutter for the instant of the strike rather than the splash after it.

It won the Wikimedia Commons community vote for Picture of the Year in 2020 — chosen from among tens of thousands of freely licensed photographs submitted that year.`,
    preview:
      "Getting this frame means anticipating a bird that dives at roughly 25 miles an hour and is gone again in under a second.",
    author: "Luca Casale",
    source_name: "Wikimedia Commons",
    source_url:
      "https://commons.wikimedia.org/wiki/File:Alcedo_atthis_-_Riserve_naturali_e_aree_contigue_della_fascia_fluviale_del_Po.jpg",
    license: "CC BY-SA 4.0 — Luca Casale",
    tags: ["nature", "wildlife"],
    collection: "Nature",
    published_at: "2026-07-25T09:00:00Z",
    created_at: "2026-07-25T09:00:00Z",
  },
  {
    id: "b2222222-2222-4222-8222-222222222206",
    title: "A doctor's exhaustion, in one frame",
    image_url:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Covid-19_San_Salvatore_09.jpg?width=1600",
    alt_text:
      "A hospital doctor pausing against a wall, mid-shift, at San Salvatore Hospital during the 2020 COVID-19 outbreak in Italy.",
    content: `Alberto Giuliani spent time inside San Salvatore Hospital in Pesaro, Italy, during the first wave of the COVID-19 outbreak in early 2020, photographing staff between patients rather than during any single dramatic moment.

The quiet of this frame is what carried it — no ventilator, no crowd, just a person absorbing a shift that hadn't ended yet. It placed second in Wikimedia Commons' 2020 Picture of the Year vote.`,
    preview:
      "Alberto Giuliani spent time inside San Salvatore Hospital in Pesaro, Italy, during the first wave of the COVID-19 outbreak in early 2020.",
    author: "Alberto Giuliani",
    source_name: "Wikimedia Commons",
    source_url: "https://commons.wikimedia.org/wiki/File:Covid-19_San_Salvatore_09.jpg",
    license: "CC BY-SA 4.0 — Alberto Giuliani",
    tags: ["photojournalism", "health"],
    collection: "Photojournalism",
    published_at: "2026-07-26T09:00:00Z",
    created_at: "2026-07-26T09:00:00Z",
  },
];
