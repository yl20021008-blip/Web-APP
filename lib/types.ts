export type UserSession = {
  userId: number;
  displayName: string;
};

export type WordTask = {
  id: number;
  book_name: string | null;
  chapter: string | null;
  original_number: number | null;
  word: string;
  part_of_speech: string | null;
  annotation: string | null;
  expansion: string | null;
  collocation: string | null;
  example_sentence: string | null;
  example_translation: string | null;
  uk_phonetic: string | null;
  us_phonetic: string | null;
  uk_audio_url: string | null;
  us_audio_url: string | null;
  status: string;
  mastery_level: number;
  total_reviews: number;
  next_review_at: string | null;
  task_type: "new" | "review";
};

export type DashboardMetrics = {
  totalWords: number;
  dueReviews: number;
  newWords: number;
  learnedWords: number;
  totalUsers: number;
};
