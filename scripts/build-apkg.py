#!/usr/bin/env python3
"""
scripts/build-apkg.py
Builds an AnkiMobile-compatible .apkg using genanki.
Audio, templates, CSS, quiz JS — everything included.
"""
import os, sys, glob

sys.path.insert(0, os.path.dirname(__file__))
import genanki

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EDGE_URL = os.environ["SUPABASE_URL"]

def read_tpl(name):
    with open(os.path.join(BASE, "anki-templates", name), encoding="utf-8") as f:
        return f.read()

def replace_edge(html):
    return html.replace("https://SUPABASE_EDGE_URL", EDGE_URL)

# ── Parse templates ─────────────────────────────────────
def _is_separator(line):
    """Skip HTML comment separator lines (═══, ───, bare -->)"""
    s = line.strip()
    if not s:
        return False
    # Lines that are just dashes/equals with optional comment markers
    import re
    if re.match(r'^(\s*<!\-\-)?\s*[─═]{5,}', s):
        return True
    if re.match(r'^\s*[─═]{5,}\s*\-\->\s*$', s):
        return True
    return False

def parse_template(filename, do_replace=True):
    raw = read_tpl(filename)
    if do_replace:
        raw = replace_edge(raw)
    lines = raw.split("\n")
    front, back = [], []
    in_back = False
    past_front = False
    for line in lines:
        if "FRONT TEMPLATE" in line:
            past_front = True; continue
        if "BACK TEMPLATE" in line:
            in_back = True; continue
        if not past_front:
            continue
        # Skip separator comment lines
        if _is_separator(line):
            continue
        if in_back:
            back.append(line)
        else:
            front.append(line)
    return "\n".join(front).strip(), "\n".join(back).strip()

def parse_grammar():
    raw = replace_edge(read_tpl("grammar-cards.html"))
    import re
    sections = re.split(r"<!-- ══+\s*KART \d", raw)
    cards = []
    for sec in sections[1:]:
        fm = "<!-- FRONT -->"
        bm = "<!-- BACK -->"
        fi = sec.find(fm)
        bi = sec.find(bm)
        if fi == -1 or bi == -1:
            continue
        front = sec[fi+len(fm):bi].strip()
        back = sec[bi+len(bm):].strip()
        cards.append((front, back))
    return cards

# ── Fields ──────────────────────────────────────────────
VOCAB_FIELDS = [
    'Dutch','English','Turkish','Schema','Level','FrequencyRank',
    'Article','Plural','Diminutive','DeHetRule','OnlyPlural',
    'PresensIK','PresensJIJ','PresensHIJ','PresensWIJ','PresensJULLIE','PresensZIJ',
    'OVT','OVT_IK','OVT_JIJ','OVT_HIJ','OVT_WIJ','OVT_JULLIE','OVT_ZIJ',
    'Perfectum','AuxVerb','Prefix','IsReflexive','IsSeparable',
    'ReflexiveIK','ReflexiveJIJ','ReflexiveHIJ','ReflexiveWIJ','ReflexiveJULLIE','ReflexiveZIJ',
    'AlsoNonReflexive','NonReflexiveMeaning',
    'Comparative','Superlative','InflectieRule','AlsoAdverb','OnlyPredicate',
    'WordOrder','WordOrderNote','ContrastWith',
    'TurkishA','TurkishB','EnglishA','EnglishB',
    'MeaningAType','MeaningAPerfectum','MeaningAAuxVerb','MeaningAExample',
    'MeaningBType','MeaningBPerfectum','MeaningBAuxVerb','MeaningBExample',
    'OvtNote','TRegel','GERule','BijzinExample','PerfectumRule',
    'ExampleNL','ExampleTR','ExampleEN','IPA','AudioURL','UsageNote',
    'Tags',
]

GRAMMAR_FIELDS = [
    'Topic','Level','Category','Rule','RuleNote','Contrast','CommonMistake',
    'Example1NL','Example1TR','Example1EN',
    'Example2NL','Example2TR','Example2EN',
    'Example3NL','Example3TR',
    'GapQ1','GapA1','GapNote1','GapQ2','GapA2','GapNote2',
    'ErrorQ','ErrorA','ErrorNote',
    'RuleQ1','RuleA1','RuleNote1','RuleQ2','RuleA2','RuleNote2',
    'TransQ','TransA',
    'Tags',
]

# ── Build models ────────────────────────────────────────
css = read_tpl("shared.css")
k1_front, k1_back = parse_template("kart1-nl-tr.html")
k2_front, k2_back = parse_template("kart2-tr-nl.html")
grammar_cards = parse_grammar()

vocab_model = genanki.Model(
    1714100000000,
    "DutchDeck",
    fields=[{"name": f} for f in VOCAB_FIELDS],
    templates=[
        {"name": "NL → TR", "qfmt": k1_front, "afmt": k1_back},
        {"name": "TR → NL", "qfmt": k2_front, "afmt": k2_back},
    ],
    css=css,
)

grammar_model = genanki.Model(
    1714100000001,
    "DutchDeck Grammar",
    fields=[{"name": f} for f in GRAMMAR_FIELDS],
    templates=[
        {"name": ["Rule","Example","Quiz"][i], "qfmt": c[0], "afmt": c[1]}
        for i, c in enumerate(grammar_cards)
    ],
    css=css,
)

# ── Read TSV ────────────────────────────────────────────
def read_tsv(filename):
    rows = []
    with open(os.path.join(BASE, "exports", filename), encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            rows.append(line.split("\t"))
    return rows

# ── Build deck ──────────────────────────────────────────
vocab_deck = genanki.Deck(1714000000000, "DutchDeck")
grammar_deck = genanki.Deck(1714000000001, "DutchDeck::Grammar")

audio_idx = VOCAB_FIELDS.index("AudioURL")
audio_dir = os.path.join(BASE, "exports", "audio")
media_files = []

print("📚 Vocabulary cards...")
vocab_rows = read_tsv("dutchdeck-cards.txt")
for row in vocab_rows:
    # Pad row to match fields
    while len(row) < len(VOCAB_FIELDS):
        row.append("")
    # Fix AudioURL: full URL → filename
    url = row[audio_idx]
    if url.startswith("http"):
        row[audio_idx] = url.split("/")[-1]
    # Collect audio file
    fname = row[audio_idx]
    if fname:
        fpath = os.path.join(audio_dir, fname)
        if os.path.exists(fpath) and os.path.getsize(fpath) > 0:
            if fpath not in media_files:
                media_files.append(fpath)
    
    note = genanki.Note(model=vocab_model, fields=row[:len(VOCAB_FIELDS)])
    vocab_deck.add_note(note)

print(f"   ✅ {len(vocab_rows)} vocabulary notes")

print("📖 Grammar cards...")
grammar_rows = read_tsv("dutchdeck-grammar.txt")
for row in grammar_rows:
    while len(row) < len(GRAMMAR_FIELDS):
        row.append("")
    note = genanki.Note(model=grammar_model, fields=row[:len(GRAMMAR_FIELDS)])
    grammar_deck.add_note(note)

print(f"   ✅ {len(grammar_rows)} grammar notes")

# ── Package ─────────────────────────────────────────────
print(f"\n🎵 Adding {len(media_files)} audio files...")
pkg = genanki.Package([vocab_deck, grammar_deck])
pkg.media_files = media_files

out_path = os.path.join(BASE, "exports", "DutchDeck.apkg")
pkg.write_to_file(out_path)

size_mb = os.path.getsize(out_path) / 1024 / 1024
print(f"\n✅ exports/DutchDeck.apkg ({size_mb:.1f} MB)")
print(f"   📚 {len(vocab_rows)} vocabulary · 📖 {len(grammar_rows)} grammar · 🎵 {len(media_files)} audio")
print(f"\n🎯 Send to iPhone → open in AnkiMobile → Done!")
