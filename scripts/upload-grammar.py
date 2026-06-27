#!/usr/bin/env python3
"""Upload grammar topics to Supabase grammar_topics table"""
import json, os, requests

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_ANON_KEY"]

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

with open("data/grammar-topics.json", encoding="utf-8") as f:
    topics = json.load(f)

print(f"📖 Uploading {len(topics)} grammar topics...")

for i, t in enumerate(topics):
    row = {
        "level": t["level"],
        "title": t["topic"],
        "explanation": t.get("rule", ""),
        "examples": json.dumps({
            "ruleNote": t.get("ruleNote", ""),
            "contrast": t.get("contrast", ""),
            "commonMistake": t.get("commonMistake", ""),
        }, ensure_ascii=False),
        "order_index": i + 1,
    }
    
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/grammar_topics",
        headers=headers,
        json=row
    )
    
    if r.status_code in (201, 200):
        print(f"  ✅ [{i+1}] {t['topic']}")
    elif r.status_code == 409:
        print(f"  ⏭ [{i+1}] {t['topic']} (already exists)")
    else:
        print(f"  ❌ [{i+1}] {t['topic']} → {r.status_code}: {r.text}")

print(f"\n✅ Done!")
