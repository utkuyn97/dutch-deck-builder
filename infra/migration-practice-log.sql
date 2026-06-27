-- DutchDeck — Daily Practice Log Migration
-- Run this in the Supabase SQL Editor

-- Log table
CREATE TABLE IF NOT EXISTS daily_practice_log (
  word      text        NOT NULL,
  date      date        NOT NULL DEFAULT CURRENT_DATE,
  level     text,
  schema    text,
  practiced boolean     NOT NULL DEFAULT false,
  logged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (word, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_log_date ON daily_practice_log (date);
CREATE INDEX IF NOT EXISTS idx_log_practiced ON daily_practice_log (date, practiced);

-- Word context history (for the practice PWA)
CREATE TABLE IF NOT EXISTS word_context_history (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  word             text        NOT NULL,
  context_category text        NOT NULL,
  sentence_given   text,
  user_response    text,
  used_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctx_word ON word_context_history (word);
CREATE INDEX IF NOT EXISTS idx_ctx_used ON word_context_history (word, used_at DESC);

-- RLS (works with the Edge Function service role; anon for read access)
ALTER TABLE daily_practice_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_context_history ENABLE ROW LEVEL SECURITY;

-- Anon: read only (for the practice PWA)
CREATE POLICY "anon_read_log" ON daily_practice_log
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_ctx" ON word_context_history
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_ctx" ON word_context_history
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_log" ON daily_practice_log
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- The Edge Function service role can perform all operations (policy bypass)
