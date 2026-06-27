-- Run this once in Supabase SQL Editor if the Web App reports missing defaults or slow queries.

ALTER TABLE public.learning_status
ALTER COLUMN total_reviews SET DEFAULT 0,
ALTER COLUMN correct_count SET DEFAULT 0,
ALTER COLUMN wrong_count SET DEFAULT 0,
ALTER COLUMN fuzzy_count SET DEFAULT 0,
ALTER COLUMN consecutive_correct SET DEFAULT 0,
ALTER COLUMN difficult_flag SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_learning_user_status_web
ON public.learning_status(user_id, status);

CREATE INDEX IF NOT EXISTS idx_learning_user_due_web
ON public.learning_status(user_id, status, next_review_at);

CREATE INDEX IF NOT EXISTS idx_words_chapter_number_web
ON public.words(chapter, original_number, id);

CREATE INDEX IF NOT EXISTS idx_review_user_time_web
ON public.review_logs(user_id, reviewed_at);
