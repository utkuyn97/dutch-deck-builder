# DutchDeck 🇳🇱

A personal Dutch-learning system that turns a frequency-ranked word list into a
fully-voiced, bidirectional flashcard deck — generated with Claude, voiced with
ElevenLabs, and exportable straight into Anki as a `.apkg`.

## What it does

Learning Dutch vocabulary well needs three things that off-the-shelf decks rarely
combine: cards ordered by real-world frequency, native-quality audio for *every*
card, and grammatically rich notes (articles, plurals, verb conjugations, separable
prefixes, example sentences in both directions). DutchDeck builds exactly that.

A generation pipeline takes a seed word list (extracted from an Anki `.apkg`),
sends each word through **Anthropic Claude** to produce a structured linguistic
card (schema detection, conjugation tables, NL/EN example sentences), then calls
**ElevenLabs** to synthesise an MP3 for each card. The enriched cards and audio
are stored in Supabase and exported back into a ready-to-import Anki package.

On top of the deck sits a small **React PWA** for daily practice: a PIN-gated home
screen and two AI practice chats (word drills and grammar drills) backed by Supabase
Edge Functions, so you can practise conversationally on a phone while Anki handles
the spaced-repetition (SM-2) scheduling.

## Tech stack

- **Frontend:** React 19 + Vite (installable PWA), vanilla CSS design tokens
- **Backend / data:** Supabase — Postgres, Storage (audio), Edge Functions (Deno)
- **AI / APIs:**
  - **ElevenLabs** — per-card text-to-speech audio generation, batched & cached
  - **Anthropic Claude** (`claude-sonnet-4-6`) — structured flashcard generation
- **Anki export:** `sql.js` + `better-sqlite3` to build the Anki SQLite collection, `jszip` to package it into a `.apkg`

## Architecture / notable design decisions

- **ElevenLabs voice generation at scale.** Audio is generated once per card in
  batched runs (configurable `BATCH_SIZE` / `BATCH_DELAY_MS`), persisted to Supabase
  Storage, and referenced from Anki cards via `[sound:…]` tags — so a ~5k-card deck
  becomes fully voiced without re-hitting the API on every study session. The full
  production deck is ~5,000 frequency-ranked cards (extended to bidirectional notes
  in Anki).
- **Bidirectional cards from a single source.** Each word produces both an NL→EN and
  an EN/TR→NL Anki template (see [`anki-templates/`](anki-templates/)), with separate
  example fields per direction, generated from one Claude-built record.
- **Programmatic `.apkg` export.** Rather than relying on Anki's UI, the deck is built
  at the SQLite level (`sql.js`) and zipped into a valid `.apkg` — reproducible and
  scriptable. See [`scripts/build-apkg.cjs`](scripts/build-apkg.cjs).
- **Frequency-first ordering.** Cards carry a `frequency_rank` so the highest-impact
  vocabulary is learned first; `reindex-ranks` keeps ranks stable as the deck grows.
- **PIN-gated PWA + Edge Functions.** The practice app holds no service credentials;
  it talks to Supabase Edge Functions with a shared app token, and database access is
  guarded by Row-Level Security.

A sample of the generated card format lives in
[`data/sample-deck.json`](data/sample-deck.json) (100 cards). The full deck and audio
are regenerated locally from your own seed deck + API keys — they are intentionally
**not** committed (the audio alone is ~300 MB).

```jsonc
// data/sample-deck.json — one card
{
  "frequency_rank": 6,
  "dutch": "zijn",
  "pos": "verb",
  "definition_en": "to be",
  "example_nl": "Honden zijn aanhankelijke en trouwe dieren.",
  "example_en": "Dogs are affectionate and loyal animals.",
  "audio_tag": "[sound:Nl-zijn.mp3]"
}
```

## Setup

```bash
# 1. Clone
git clone <your-fork-url> && cd dutch-deck-builder

# 2. Install
npm install

# 3. Configure
cp .env.example .env        # fill in Supabase / Anthropic / ElevenLabs keys

# 4. Run the PWA
npm run dev
```

Database schema lives in [`infra/schema.sql`](infra/schema.sql). To (re)generate the
deck end-to-end:

```bash
node scripts/extract-deck.cjs     # seed .apkg  -> data/extracted-deck.json
node scripts/generate-cards.cjs   # Claude enrich + ElevenLabs audio -> Supabase
node scripts/build-apkg.cjs       # export a ready-to-import DutchDeck.apkg
```

The Claude generation prompt is documented in
[`prompts/card-generation.md`](prompts/card-generation.md).

## Status

Personal / portfolio project, paused. Built end-to-end as a real tool I use to learn
Dutch; published here to show the AI-generation pipeline and Anki/ElevenLabs
integration rather than as a maintained product.

## License

MIT — see [LICENSE](LICENSE).
