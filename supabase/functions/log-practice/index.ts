/**
 * supabase/functions/log-practice/index.ts
 * 
 * Called from Anki TR→NL cards via an img trick.
 * word + date UNIQUE — no matter how many times a card is shown, only 1 log.
 * 
 * Deploy: supabase functions deploy log-practice
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Transparent 1x1 GIF — so the img loads
const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const word = url.searchParams.get("word") || "";
    const level = url.searchParams.get("level") || "";
    const schema = url.searchParams.get("schema") || "";

    // Validation
    if (!word || word.length > 100) {
      return gifResponse();
    }

    // Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // INSERT ON CONFLICT DO NOTHING — we swallow the duplicate
    const { error } = await supabase
      .from("daily_practice_log")
      .insert({
        word: word.toLowerCase().trim(),
        level: level.toUpperCase().trim() || null,
        schema: schema.toLowerCase().trim() || null,
        practiced: false,
      })
      .select()
      .single();

    // UNIQUE conflict (23505) is normal — skip silently
    if (error && error.code !== "23505") {
      console.error("Log error:", error.message);
    }

  } catch (err) {
    console.error("Edge fn error:", err);
  }

  // Always return a 1x1 transparent GIF — so the img loads
  return gifResponse();
});

function gifResponse() {
  return new Response(TRANSPARENT_GIF, {
    headers: {
      ...corsHeaders,
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
