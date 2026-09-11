export interface NoteTemplate {
  name: string;
  /** One line of what the template is for — shown under the name in the picker. */
  blurb: string;
  /** Decorative glyph; the picker labels each row by name, not by icon. */
  icon: string;
  content: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    name: "Blank note",
    blurb: "An empty page, nothing in the way",
    icon: "✏️",
    content: "",
  },
  {
    name: "Meeting notes",
    blurb: "Attendees, discussion, decisions, next steps",
    icon: "🗓️",
    content:
      "## Meeting\n\nDate: \nAttendees: \n\n## Discussion\n\n- \n\n## Decisions\n\n- \n\n## Next steps\n\n- [ ] ",
  },
  {
    name: "Daily reflection",
    blurb: "Close the day: what happened, what you learned",
    icon: "🌙",
    content:
      "## What happened today?\n\n\n## What went well?\n\n\n## What did I learn?\n\n\n## Tomorrow\n\n- [ ] ",
  },
  {
    name: "Project planning",
    blurb: "Goal, milestones, risks and open questions",
    icon: "🧭",
    content:
      "## Goal\n\n\n## Success looks like\n\n\n## Milestones\n\n- [ ] \n\n## Risks and questions\n\n- ",
  },
  {
    name: "Study notes",
    blurb: "Key ideas with a recall prompt for revisiting",
    icon: "📚",
    content:
      "## Topic\n\n\n## Key ideas\n\n- \n\n## Questions\n\n- \n\n## Recall practice\n\nThe key idea is **answer**.\n\n## Sources\n\n",
  },
];
