import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];

// Row shapes come straight from the database types, so a schema change that
// isn't reflected in the UI becomes a compile error rather than a runtime one.
export type Notebook = Tables["notebooks"]["Row"];
/** List rows omit full content until `ensureNote` hydrates them. */
export type Note = Tables["notes"]["Row"] & { bodyLoaded: boolean };
export type Profile = Tables["profiles"]["Row"];
export type Thought = Tables["thoughts"]["Row"];
export type Visual = Tables["visuals"]["Row"];

/** Fields the user actually supplies when creating a note. */
export type NewNote = Pick<
  Tables["notes"]["Insert"],
  "title" | "content" | "notebook_id" | "is_pinned" | "tags"
>;

/** Fields the user can change on an existing note. */
export type NoteUpdate = Tables["notes"]["Update"];

export type Theme = "dark" | "light" | "system";
