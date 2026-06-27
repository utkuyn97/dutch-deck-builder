/**
 * src/lib/api.js
 * Sprint 3: Supabase + AI chat API calls
 */

import { supabase } from './supabase.js';

const EDGE_BASE = import.meta.env.VITE_SUPABASE_URL;
const AI_CHAT_URL = `${EDGE_BASE}/functions/v1/ai-chat`;

// ── Today's words from daily_practice_log ──────────

export async function fetchTodayWords() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('daily_practice_log')
    .select('word, level, schema, practiced')
    .eq('date', today)
    .order('logged_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// ── Get word details from dutch_cards ──────────────

export async function fetchWordDetails(word) {
  const { data, error } = await supabase
    .from('cards')
    .select('dutch, schema, level, card_data, frequency_rank')
    .ilike('dutch', word)
    .limit(1)
    .single();

  if (error) {
    return { dutch: word, english: '', turkish: '', schema: '', level: '' };
  }
  
  const cd = data.card_data || {};
  return {
    dutch: data.dutch,
    english: cd.english || '',
    turkish: cd.turkish || '',
    schema: data.schema,
    level: data.level,
    frequency_rank: data.frequency_rank,
  };
}

// ── Mark word as practiced ────────────────────────

export async function markPracticed(word) {
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase
    .from('daily_practice_log')
    .update({ practiced: true })
    .eq('word', word)
    .eq('date', today);

  if (error) console.error('markPracticed error:', error);
}

// ── Get context history for a word ────────────────

export async function fetchContextHistory(word) {
  const { data, error } = await supabase
    .from('word_context_history')
    .select('context_category')
    .eq('word', word)
    .order('used_at', { ascending: false })
    .limit(5);

  if (error) return [];
  return (data || []).map(d => d.context_category);
}

// ── Save context to history ───────────────────────

export async function saveContextHistory(word, context, sentence, response) {
  await supabase.from('word_context_history').insert({
    word,
    context_category: context,
    sentence_given: sentence || null,
    user_response: response || null,
  });
}

const DD_TOKEN = import.meta.env.VITE_DD_API_TOKEN;

export async function aiChat(body) {
  const res = await fetch(AI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-dd-token': DD_TOKEN || '',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `AI error: ${res.status}`);
  }

  return res.json();
}

// ── Fetch grammar topics ─────────────────────────

export async function fetchGrammarTopics() {
  const { data, error } = await supabase
    .from('grammar_topics')
    .select('id, title, level, explanation, order_index')
    .order('order_index', { ascending: true });

  if (error) return [];
  // Map to expected format
  return (data || []).map(d => ({
    topic: d.title,
    level: d.level,
    category: 'grammar',
    rule: d.explanation,
  }));
}
