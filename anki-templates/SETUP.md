# DutchDeck Anki Templates — Setup

## Files

| File | What |
|-------|----|
| `shared.css` | All card styles — paste into the Anki Styling area |
| `kart1-nl-tr.html` | NL→TR card (recognition + all technical details + API log) |
| `kart2-tr-nl.html` | TR→NL card (production + deterministic quiz) |

---

## Setup Steps

### 1. Create Note Type

Anki → Tools → Manage Note Types → Add:
- Select "Add: Basic"
- Name: **DutchDeck**

### 2. Add Fields (in this order)

Note type → Fields button → add in order:

```
Dutch, English, Turkish, Schema, Level, FrequencyRank,
Article, Plural, Diminutive, DeHetRule, OnlyPlural,
PresensIK, PresensJIJ, PresensHIJ, PresensWIJ, PresensJULLIE, PresensZIJ,
OVT, OVT_IK, OVT_JIJ, OVT_HIJ, OVT_WIJ, OVT_JULLIE, OVT_ZIJ,
Perfectum, AuxVerb, Prefix, IsReflexive, IsSeparable,
ReflexiveIK, ReflexiveJIJ, ReflexiveHIJ, ReflexiveWIJ, ReflexiveJULLIE, ReflexiveZIJ,
AlsoNonReflexive, NonReflexiveMeaning,
Comparative, Superlative, InflectieRule, AlsoAdverb, OnlyPredicate,
WordOrder, WordOrderNote, ContrastWith,
TurkishA, TurkishB, EnglishA, EnglishB,
MeaningAType, MeaningAPerfectum, MeaningAAuxVerb, MeaningAExample,
MeaningBType, MeaningBPerfectum, MeaningBAuxVerb, MeaningBExample,
OvtNote, TRegel, GERule, BijzinExample, PerfectumRule,
ExampleNL, ExampleTR, ExampleEN, IPA, AudioURL, UsageNote
```

### 3. Configure Cards (Card Types)

Note type → Cards button

**Card 1 — NL→TR:**
- Card Type Name: `NL → TR`
- Front Template: the FRONT TEMPLATE section in `kart1-nl-tr.html`
- Back Template: the BACK TEMPLATE section in `kart1-nl-tr.html`

**Card 2 — TR→NL:**
- Card Type Name: `TR → NL`
- Front Template: the FRONT TEMPLATE section in `kart2-tr-nl.html`
- Back Template: the BACK TEMPLATE section in `kart2-tr-nl.html`

### 4. Styling

Note type → Cards → Styling tab:
→ paste the contents of `shared.css`

### 5. Update SUPABASE_EDGE_URL

In `kart1-nl-tr.html`, replace `SUPABASE_EDGE_URL` with your own Edge Function URL:

```
https://PROJE_ID.supabase.co/functions/v1/log-practice
```

### 6. Import the Cards

```bash
node scripts/export-to-anki.cjs
```

Anki → File → Import → `exports/dutchdeck-cards.txt`
- Note type: DutchDeck
- Field separator: Tab
- Allow HTML: Yes

---

## Card Behaviors

### NL→TR Card
```
Front:   huis

Back:    huis  [noun] [A1] [#87]
          /hœys/
          
          house       ← English MAIN
          🇹🇷 ev       ← Turkish supplementary
          
          [Artikel]   het huis
          [Meervoud]  huizen
          [Verkleinw] huisje
          [Regel]     gebouwen usually take het
          
          🇳🇱 "Ik woon in een groot huis."
          🇬🇧 "I live in a big house."
          🇹🇷 "Büyük bir evde yaşıyorum."
          
          [audio plays]
          [API log sent → Supabase daily_practice_log]
```

### TR→NL Card
```
Front:   house
         🇹🇷 ev
         noun · A1

Back:    huis  [noun] [A1]
          /hœys/
          
          het huis  mv. huizen
          
          🇳🇱 "Ik woon in een groot huis."
          
          [audio plays]
          
          Quiz:
          ┌─────────────────────────────┐
          │ de or het?       [Show]    │
          │ ─────────────────────────── │
          │ het huis            ✅      │
          │ 💡 gebouwen → het           │
          └─────────────────────────────┘
          ┌─────────────────────────────┐
          │ Meervoud?         [Show]   │
          └─────────────────────────────┘
          ┌─────────────────────────────┐
          │ Verkleinwoord?    [Show]   │
          └─────────────────────────────┘
```

### Quiz Behavior

- Each question is hidden initially
- Pressing the "Show" button reveals the answer
- If wrong → press **Again** in Anki → the card enters relearning
- If no mistakes on the quiz → press **Good** or **Easy**

---

## Schema → Quiz Questions Table

| Schema | Quiz Questions |
|--------|---------------|
| noun | de/het · meervoud · verkleinwoord |
| verb_regular | ik presens · jij presens · OVT · perfectum · hebben/zijn |
| verb_irregular | ik presens · OVT ik · OVT wij · perfectum · hebben/zijn |
| verb_separable | prefix · ik presens (separated) · OVT · perfectum · hebben/zijn · bijzin |
| verb_inseparable | prefix · ik presens · OVT · perfectum (no ge-) · hebben/zijn |
| verb_dual | meaning a · a perfectum · meaning b · b perfectum |
| verb_reflexive | ik reflexief · hij reflexief · wij reflexief · perfectum · non-reflexive? |
| adjective | comparative · superlative · inflectie rule |
| conjunction | word order · contrast with |
| adverb | No quiz |
| preposition | No quiz |
