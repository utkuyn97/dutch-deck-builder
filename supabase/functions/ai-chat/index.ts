/**
 * supabase/functions/ai-chat/index.ts
 *
 * PWA → Edge Function → Anthropic claude-haiku-4-5-20251001 proxy.
 * Frontend'de API key yok. Tüm AI çağrıları buradan geçer.
 *
 * Routes:
 *   POST /functions/v1/ai-chat
 *   Body: { type, word, level, schema, english, turkish,
 *           context_history, scenario, user_message, topic, rule_summary,
 *           messages }
 *
 * Deploy: npx supabase functions deploy ai-chat --no-verify-jwt
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-dd-token",
};

// ── Prompt builders ────────────────────────────────────

function wordAssignmentPrompt(p: any): string {
  // Schema-specific usage notes
  const schemaGuide: Record<string, string> = {
    preposition: `'${p.word}' bir edattır. Bu edatın Hollandacadaki doğru kullanım yapılarını düşün (ör: "te" → "om te + infinitief", "proberen te + infinitief" ama "willen/kunnen/moeten" ile te KULLANILMAZ). Sadece gramer açısından doğru olan bir yapıda kullanılabilecek senaryo ver.`,
    conjunction: `'${p.word}' bir bağlaçtır. Ana cümle + yan cümle yapısında doğru kelime sırası (woordvolgorde) gerektiren bir senaryo düşün.`,
    adverb: `'${p.word}' bir zarftır. Cümlede doğru konumda kullanılacak bir senaryo ver.`,
    noun: `'${p.word}' bir isimdir. de/het artikelini ve mümkünse çoğul formunu da pekiştiren bir senaryo ver.`,
    adjective: `'${p.word}' bir sıfattır. Büküm kurallarını (inflectie) pekiştiren bir senaryo ver.`,
  };
  
  const verbSchemas = ['verb_regular', 'verb_irregular', 'verb_separable', 'verb_inseparable', 'verb_dual', 'verb_reflexive'];
  const guide = schemaGuide[p.schema] || (
    verbSchemas.includes(p.schema)
      ? `'${p.word}' bir fiildir (${p.schema}). Doğru çekimi (presens/OVT/perfectum) kullanmayı gerektiren bir senaryo ver.`
      : `'${p.word}' kelimesinin doğru kullanıldığı bir senaryo ver.`
  );

  return `Sen bir Hollandaca öğretmenisisin. Kullanıcı B1'e yakın seviyede.

Kelime: ${p.word} (${p.level}, ${p.schema})
İngilizce: ${p.english}
Türkçe: ${p.turkish}

${guide}

Bu kelimenin daha önce kullanıldığı bağlamlar: ${JSON.stringify(p.context_history || [])}
Son 5'te kullanılan bağlamları tekrar etme.

KURALLAR:
1. Önce '${p.word}' kelimesinin Hollandacada hangi gramer yapılarında DOĞRU kullanıldığını düşün.
2. Gerçek bir günlük hayat veya iş durumu ver (Türkçe, 1 cümle). Örnek durumlar: iş toplantısı, süpermarket, doktor, ev arkadaşıyla konuşma, e-posta yazma, telefon açma, komşuyla sohbet.
3. Sonra "Bunu Hollandaca nasıl söylersin?" formatında sor.
4. Örnek cümle yapısı VERME. Kullanıcı kendi başına kursun.
5. Hint kelimeler verme veya en fazla 1 tane ver.

JSON formatında yanıt ver (sadece JSON, başka bir şey yazma):
{
  "context": "kategori (iş/günlük/sosyal)",
  "scenario": "Durum açıklaması + 'Bunu Hollandaca nasıl söylersin?'",
  "hint_words": [],
  "instruction": "'${p.word}' kelimesini kullanarak cümle kur."
}`;
}

function wordFeedbackPrompt(p: any): string {
  return `Sen bir Hollandaca öğretmenisisin. Kullanıcının seviyesini belirtme, seviye analizi yapma.

Kelime: ${p.word} (${p.schema})
Senaryo: ${p.scenario}
Kullanıcının cevabı: ${p.user_message}

Şunları kontrol et:
1. Gramer doğru mu? (Yanlışsa neyi nasıl düzeltmesi gerektiğini göster)
2. '${p.word}' kelimesi doğru yapıda kullanılmış mı?
3. Bu cümle doğal mı? Bir Hollandalı bunu böyle söyler mi?
4. Daha doğal/yaygın bir alternatif varsa göster

FORMAT:
- Kısa ol, gereksiz övgü yapma
- Doğruysa "✅ Doğru" de, 1 cümle açıklama yeter
- Yanlışsa net düzelt, doğru formu göster
- Türkçe açıkla, Hollandaca örnekleri *italik* yaz`;
}

function wordChatPrompt(p: any): string {
  return `Sen bir Hollandaca öğretmenisisin. Kullanıcı seninle '${p.word}' (${p.level}, ${p.schema}) kelimesini çalışıyor.

Kelime bilgisi:
- Hollandaca: ${p.word}
- İngilizce: ${p.english || '?'}
- Türkçe: ${p.turkish || '?'}
- Şema: ${p.schema}
${p.scenario ? `\nSenaryo: ${p.scenario}` : ''}

Kurallar:
- Kullanıcı serbest soru sorabilir, cevap isteyebilir, yeni soru isteyebilir.
- "cevap ne", "doğrusu ne", "nasıl yazılır" gibi sorularda net cevap ver.
- "başka soru", "yeni soru" gibi isteklerde yeni bir pratik sorusu sor.
- Kısa, net yanıt ver. Türkçe açıkla, Hollandaca örnekleri *italik* göster.
- Gereksiz tekrar yapma, konuşma doğal aksın.`;
}

function grammarExercisePrompt(p: any): string {
  return `Sen bir Hollandaca öğretmenisisin.
Kullanıcı ${p.level} seviyesinde.

Konu: ${p.topic}
Kural özeti: ${p.rule_summary}

Bu konuda 5 egzersiz üret ve sırayla sor:
- 2 boşluk doldurma (___ ile işaretle)
- 1 hatalı cümleyi düzelt
- 1 Türkçeden Hollandacaya çeviri
- 1 kural açıklama sorusu

Her egzersizde:
1. Soruyu sor
2. Kullanıcı cevap verinceye kadar bekle
3. ✅/❌ + kısa Türkçe açıklama
4. Bir sonraki soruya geç

Başla: ilk egzersizi şimdi sor.
Dil: Türkçe açıklamalar, Hollandaca örnekler.`;
}

function grammarFreePrompt(p: any): string {
  return `Sen bir Hollandaca öğretmenisisin.
Kullanıcı '${p.topic}' konusunu çalışıyor.

Konu özeti: ${p.rule_summary}

Soru: ${p.user_message}

Kısa, net yanıt ver. Konuyla bağlantılı örnek cümle ekle.
Türkçe açıkla, Hollandaca örnekler italik.`;
}

// ── Main handler ────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check ──
    const authToken = req.headers.get("x-dd-token") || "";
    const expectedToken = Deno.env.get("DD_API_TOKEN") || "";
    if (!expectedToken || authToken !== expectedToken) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { type } = body;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "API key not configured" }, 500);
    }

    let systemPrompt = "";
    let messages: { role: string; content: string }[] = [];

    // ── Route by type ──
    if (type === "word_assignment") {
      systemPrompt = wordAssignmentPrompt(body);
      messages = [{ role: "user", content: "Yeni bir senaryo oluştur." }];
    } else if (type === "word_feedback") {
      systemPrompt = wordFeedbackPrompt(body);
      messages = [
        { role: "user", content: body.user_message || "Kontrol et." },
      ];
    } else if (type === "word_chat") {
      systemPrompt = wordChatPrompt(body);
      messages = body.messages || [{ role: "user", content: body.user_message || "?" }];
    } else if (type === "grammar_start") {
      systemPrompt = grammarExercisePrompt(body);
      messages = [{ role: "user", content: "Başla." }];
    } else if (type === "grammar_continue") {
      systemPrompt = grammarExercisePrompt(body);
      messages = body.messages || [];
    } else if (type === "grammar_free") {
      systemPrompt = grammarFreePrompt(body);
      messages = [{ role: "user", content: body.user_message || "?" }];
    } else {
      return jsonResponse({ error: "Unknown type: " + type }, 400);
    }

    // ── Anthropic API call ──
    const anthropicRes = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        }),
      }
    );

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errText);
      return jsonResponse(
        { error: "AI error", status: anthropicRes.status },
        502
      );
    }

    const result = await anthropicRes.json();
    const content = result.content?.[0]?.text || "";

    // For word_assignment, try to parse JSON
    if (type === "word_assignment") {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return jsonResponse({ type: "assignment", data: parsed });
        }
      } catch {
        // Fall through to raw text
      }
    }

    return jsonResponse({
      type: "message",
      content,
      usage: result.usage,
    });
  } catch (err) {
    console.error("Edge fn error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
