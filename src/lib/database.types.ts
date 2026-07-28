// Mirrors supabase/migrations/0001_init.sql. Once your project exists you can
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
  is_pinned: boolean;
  tags: string[];
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
          is_pinned?: boolean;
          tags?: string[];
        };
        Update: {
          notebook_id?: string | null;
          title?: string;
          content?: string;
          is_pinned?: boolean;
          tags?: string[];
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
    };
    Views: Record<never, never>;
    Functions: {
      // Record<PropertyKey, never> is how postgrest-js recognises a function
      // that takes no arguments, so rpc("touch_streak") needs no second arg.
      touch_streak: {
        Args: Record<PropertyKey, never>;
        Returns: ProfileRow;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
