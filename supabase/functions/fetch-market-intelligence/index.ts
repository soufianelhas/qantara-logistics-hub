import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a Global Trade Analyst specializing in market intelligence. For a given HS Code and Product Name, your task is to identify the top 5 importing countries globally.

You must return ONLY a structured JSON object with a "markets" array. For each market provide:
- "countryCode": The 2-letter ISO code (e.g. "US", "FR", "CN")
- "countryName": The full name of the country
- "annualImportValue": Estimated annual import value for this HS code (in USD, formatted as string like "$1.2B" or "$450M")
- "averageRetailPrice": Estimated average retail price for the product in that market (in USD, as a number)
- "demandScore": A score from 0 to 100 based on market growth and accessibility
- "logisticsOverheadEstimate": A percentage number (e.g. 25.5) estimating the typical logistics, duties, and tax overheads when importing into this country.

Respond ONLY with valid JSON — no markdown fences, no explanation outside the JSON.`;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { hs_code, product_name } = await req.json();

        if (!hs_code || !product_name) {
            return new Response(
                JSON.stringify({ error: "Missing hs_code or product_name" }),
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

        const userPrompt = `HS Code: ${hs_code}\nProduct Name: ${product_name}\n\nProvide the top 5 destination markets for this product.`;

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
                    temperature: 0.3,
                    responseMimeType: "application/json"
                }
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Gemini API error:", response.status, errText);
            return new Response(
                JSON.stringify({ error: "AI service unavailable", details: errText }),
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

        let parsed;
        try {
            const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            parsed = JSON.parse(cleaned);
        } catch {
            return new Response(
                JSON.stringify({ error: "Could not parse API response into JSON", raw: content.slice(0, 300) }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(JSON.stringify(parsed), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("fetch-market-intelligence error:", err);
        return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
