// Mirrors supabase/migrations/*.sql. Once your project exists you can
// regenerate this instead of maintaining it by hand:
//   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

// Everything here is a `type`, never an `interface`. postgrest-js constrains a
// schema to Record<string, GenericTable>, and TypeScript only gives implicit
// index signatures to type aliases — an interface fails that constraint, which
// collapses every table to `never`. Generated Supabase types are aliases too.

export type NotebookRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type NoteRow = {
  id: string;
  user_id: string;
  notebook_id: string | null;
  title: string;
  content: string;
  /** Plain opening snippet for list cards — kept in sync by a DB trigger. */
  preview: string;
  is_pinned: boolean;
  tags: string[];
  /** Soft-delete timestamp; null means the note is active. */
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  streak: number;
  /** Postgres `date`, serialised as YYYY-MM-DD. */
  last_visit: string | null;
  created_at: string;
};

export type QuizProgressRow = {
  user_id: string;
  /** Postgres `date`, serialised as YYYY-MM-DD. */
  date_key: string;
  attempt: number;
  question_ids: string[];
  index: number;
  score: number;
  selected: string | null;
  phase: "ready" | "question" | "feedback" | "results";
  updated_at: string;
};

/** Curated shared stories — read-only for signed-in users. */
export type ThoughtRow = {
  id: string;
  title: string;
  content: string;
  preview: string;
  author: string;
  source_name: string;
  source_url: string;
  tags: string[];
  published_at: string;
  created_at: string;
};

export type SearchNoteRow = {
  id: string;
  user_id: string;
  notebook_id: string | null;
  title: string;
  preview: string;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  rank: number;
};

// `Relationships` is part of the shape postgrest-js requires of every table
// (GenericTable). Omit it and the whole table type silently degrades to `never`,
// which surfaces as baffling "not assignable to type 'never'" errors on insert.
// Empty is fine here — it only powers embedded-resource inference in select().
export type Database = {
  public: {
    Tables: {
      notebooks: {
        Row: NotebookRow;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: NoteRow;
        Insert: {
          id?: string;
          user_id: string;
          notebook_id?: string | null;
          title?: string;
          content?: string;
          preview?: string;
          is_pinned?: boolean;
          tags?: string[];
          deleted_at?: string | null;
        };
        Update: {
          notebook_id?: string | null;
          title?: string;
          content?: string;
          preview?: string;
          is_pinned?: boolean;
          tags?: string[];
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          streak?: number;
          last_visit?: string | null;
        };
        Update: {
          streak?: number;
          last_visit?: string | null;
        };
        Relationships: [];
      };
      quiz_progress: {
        Row: QuizProgressRow;
        Insert: {
          user_id: string;
          date_key: string;
          attempt?: number;
          question_ids?: string[];
          index?: number;
          score?: number;
          selected?: string | null;
          phase?: QuizProgressRow["phase"];
          updated_at?: string;
        };
        Update: {
          attempt?: number;
          question_ids?: string[];
          index?: number;
          score?: number;
          selected?: string | null;
          phase?: QuizProgressRow["phase"];
          updated_at?: string;
        };
        Relationships: [];
      };
      thoughts: {
        Row: ThoughtRow;
        Insert: {
          id?: string;
          title: string;
          content?: string;
          preview?: string;
          author?: string;
          source_name?: string;
          source_url?: string;
          tags?: string[];
          published_at?: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          content?: string;
          preview?: string;
          author?: string;
          source_name?: string;
          source_url?: string;
          tags?: string[];
          published_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      // Record<PropertyKey, never> is how postgrest-js recognises a function
      // that takes no arguments, so rpc("touch_streak") needs no second arg.
      touch_streak: {
        Args: Record<PropertyKey, never>;
        Returns: ProfileRow;
      };
      search_notes: {
        Args: { q: string };
        Returns: SearchNoteRow[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
