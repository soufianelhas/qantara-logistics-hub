import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a senior customs classification expert specializing in Moroccan exports under the TARIC (EU) and RITA (Morocco) systems. You help consultants classify products into the correct HS (Harmonized System) codes.

Your task: Given a product category, subcategory, and description, return a JSON array of the top 3-5 most likely HS code matches.

Each match must include:
- "hs": The 4-8 digit HS code (e.g. "1515.90")
- "description": A short label for this HS heading
- "fullDescription": A detailed explanation of what this code covers and why it matches
- "confidence": A number 0-100 indicating match confidence
- "duty": Typical EU duty rate as a percentage number (e.g. 3.2)
- "tax": Typical VAT/tax rate as a percentage number (e.g. 20)
- "eRisk": One of "low", "medium", or "high" based on typical logistics complexity
- "portOfOrigin": An array of 1-2 Moroccan ports most likely used (from: "Tanger Med", "Casablanca", "Agadir")

Sort results by confidence descending. Be precise with HS codes — use real TARIC headings.

If the description is ambiguous, include a "clarificationNeeded" field with a follow-up question.

Respond ONLY with valid JSON — no markdown, no explanation outside the JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category, subcategory, description } = await req.json();

    if (!description || description.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Product description is required (min 3 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Category: ${category || "Not specified"}\nSubcategory: ${subcategory || "Not specified"}\nProduct Description: ${description}\n\nClassify this Moroccan export product and return the top HS code matches as a JSON array.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);

      return new Response(
        JSON.stringify({ error: "AI classification service unavailable", details: errText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI model" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON from the AI response (strip markdown fences if present)
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Could not parse classification results", raw: content.slice(0, 300) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ results: Array.isArray(parsed) ? parsed : [parsed] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("hs-classify error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
