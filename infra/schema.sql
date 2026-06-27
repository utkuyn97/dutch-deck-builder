-- DutchDeck — Supabase Schema
-- infra/schema.sql
-- Run in the Supabase SQL Editor

-- =====================
-- CARDS
-- =====================
CREATE TABLE IF NOT EXISTS cards (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  frequency_rank int UNIQUE,
  dutch          text NOT NULL,
  schema         text NOT NULL, -- noun/verb_regular/verb_irregular/verb_separable/verb_inseparable/verb_dual/verb_reflexive/adjective/adverb/conjunction/preposition
  level          text,          -- A1/A2/B1/B2/C1
  card_data      jsonb NOT NULL, -- full schema object
  audio_url      text,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_cards_dutch ON cards(dutch);
CREATE INDEX idx_cards_rank ON cards(frequency_rank);
CREATE INDEX idx_cards_level ON cards(level);
CREATE INDEX idx_cards_schema ON cards(schema);

-- =====================
-- CARD PROGRESS
-- =====================
CREATE TABLE IF NOT EXISTS card_progress (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id         uuid REFERENCES cards(id) ON DELETE CASCADE,
  sibling_id      uuid REFERENCES card_progress(id),
  direction       text NOT NULL,  -- 'nl_tr' | 'tr_nl'
  queue           text NOT NULL DEFAULT 'new', -- locked|new|learning|review|relearning|suspended|buried
  ease_factor     float NOT NULL DEFAULT 2.5,
  interval        int NOT NULL DEFAULT 0,
  due_timestamp   timestamptz DEFAULT now(),
  learning_step   int NOT NULL DEFAULT 0,
  lapses          int NOT NULL DEFAULT 0,
  repetitions     int NOT NULL DEFAULT 0,
  last_reviewed   timestamptz,
  is_leech        boolean DEFAULT false,
  UNIQUE(card_id, direction)
);

CREATE INDEX idx_cp_queue ON card_progress(queue);
CREATE INDEX idx_cp_due ON card_progress(due_timestamp);
CREATE INDEX idx_cp_card ON card_progress(card_id);

-- =====================
-- GRAMMAR TOPICS
-- =====================
CREATE TABLE IF NOT EXISTS grammar_topics (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level       text NOT NULL,
  title       text NOT NULL,
  explanation text NOT NULL,
  examples    jsonb,
  order_index int NOT NULL
);

CREATE INDEX idx_gt_level ON grammar_topics(level);
CREATE INDEX idx_gt_order ON grammar_topics(order_index);

-- =====================
-- GRAMMAR EXERCISES
-- =====================
CREATE TABLE IF NOT EXISTS grammar_exercises (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id   uuid REFERENCES grammar_topics(id) ON DELETE CASCADE,
  type       text NOT NULL, -- gap_fill|word_order|multiple_choice|form|error_correct|combine
  question   text NOT NULL,
  options    jsonb,
  answer     text NOT NULL,
  hint       text,
  difficulty text NOT NULL DEFAULT 'medium' -- easy|medium|hard
);

CREATE INDEX idx_ge_topic ON grammar_exercises(topic_id);

-- =====================
-- GRAMMAR PROGRESS
-- =====================
CREATE TABLE IF NOT EXISTS grammar_progress (
  topic_id    uuid REFERENCES grammar_topics(id) PRIMARY KEY,
  ease_factor float NOT NULL DEFAULT 2.5,
  interval    int NOT NULL DEFAULT 0,
  due_date    date DEFAULT CURRENT_DATE,
  repetitions int NOT NULL DEFAULT 0,
  last_score  float
);

-- =====================
-- DAILY SESSIONS
-- =====================
CREATE TABLE IF NOT EXISTS daily_sessions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date            date NOT NULL DEFAULT CURRENT_DATE,
  cards_reviewed  jsonb DEFAULT '[]', -- [{card_id, direction, rating, timestamp}]
  grammar_topic   uuid REFERENCES grammar_topics(id),
  practice_done   boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_ds_date ON daily_sessions(date);

-- =====================
-- DAILY STATS
-- =====================
CREATE TABLE IF NOT EXISTS daily_stats (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date         date UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  reviews_done int DEFAULT 0,
  success      int DEFAULT 0,
  fail         int DEFAULT 0,
  retention    float,
  new_cards    int DEFAULT 0,
  time_spent   int DEFAULT 0, -- seconds
  streak       int DEFAULT 0
);

CREATE INDEX idx_dstats_date ON daily_stats(date);

-- =====================
-- WORD CONTEXT HISTORY
-- =====================
CREATE TABLE IF NOT EXISTS word_context_history (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id           uuid REFERENCES cards(id) ON DELETE CASCADE,
  context_category  text NOT NULL,
  sentence_given    text,
  user_response     text,
  used_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_wch_card ON word_context_history(card_id);
CREATE INDEX idx_wch_used ON word_context_history(used_at);

-- =====================
-- PIPELINE STATE
-- =====================
CREATE TABLE IF NOT EXISTS pipeline_state (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  last_processed_rank   int DEFAULT 0,
  status                text DEFAULT 'idle', -- idle|running|paused|done
  errors                jsonb DEFAULT '[]',
  updated_at            timestamptz DEFAULT now()
);

-- =====================
-- PENDING WORDS (Manual Addition)
-- =====================
CREATE TABLE IF NOT EXISTS pending_words (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  word       text NOT NULL,
  added_at   timestamptz DEFAULT now(),
  status     text DEFAULT 'pending' -- pending|processed|duplicate
);

-- =====================
-- USER SETTINGS
-- =====================
CREATE TABLE IF NOT EXISTS user_settings (
  id  uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Daily limits
  new_cards_per_day           int DEFAULT 20,
  max_reviews_per_day         int DEFAULT 200,
  new_cards_ignore_review_limit boolean DEFAULT false,

  -- Learning
  learn_steps                 int[] DEFAULT '{1,10}',      -- minutes
  graduating_interval         int DEFAULT 1,               -- days
  easy_interval               int DEFAULT 4,               -- days

  -- Lapses
  relearn_steps               int[] DEFAULT '{10}',        -- minutes
  new_interval                float DEFAULT 0.00,
  minimum_interval            int DEFAULT 1,
  leech_threshold             int DEFAULT 8,
  leech_action                text DEFAULT 'flag',         -- flag|suspend

  -- SM-2
  starting_ease               float DEFAULT 2.50,
  easy_bonus                  float DEFAULT 1.30,
  interval_modifier           float DEFAULT 1.00,
  hard_interval               float DEFAULT 1.20,
  minimum_ease                float DEFAULT 1.30,
  maximum_interval            int DEFAULT 36500,

  -- Display
  bury_new_siblings           boolean DEFAULT true,
  bury_review_siblings        boolean DEFAULT true,

  -- Audio
  autoplay_front              boolean DEFAULT false,
  autoplay_back               boolean DEFAULT true,
  audio_speed                 float DEFAULT 1.0,

  -- Practice
  practice_enabled            boolean DEFAULT true,
  show_hints                  boolean DEFAULT true,
  pronunciation_check         boolean DEFAULT false,
  feedback_language           text DEFAULT 'tr',

  -- Grammar
  daily_grammar_enabled       boolean DEFAULT true,
  exercises_per_topic         int DEFAULT 8,

  -- Streak freeze
  streak_freeze_count         int DEFAULT 2,
  streak_freeze_used          int DEFAULT 0,
  streak_freeze_reset         date DEFAULT CURRENT_DATE,

  -- Onboarding
  assessment_interval         int DEFAULT 21,
  onboarding_done             boolean DEFAULT false,

  -- Notifications
  daily_reminder_time         text DEFAULT '09:00',
  streak_reminder             boolean DEFAULT true,

  -- API Keys (encrypted)
  anthropic_key_encrypted     text,
  elevenlabs_key_encrypted    text,

  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

-- Default settings row
INSERT INTO user_settings DEFAULT VALUES
ON CONFLICT DO NOTHING;
