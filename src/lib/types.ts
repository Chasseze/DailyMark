export interface Notebook {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  notebook_id: string | null;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DailyPrompt {
  id: string;
  prompt_text: string;
  type: "quote" | "quiz";
  date: string;
  source: string | null;
  options?: string[];
  correct_answer?: string;
}

export type Theme = "dark" | "light" | "system";
