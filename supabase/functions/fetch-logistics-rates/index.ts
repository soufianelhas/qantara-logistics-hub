import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Route {
  mode: "Sea" | "Air" | "Road" | "Rail";
  provider: string;
  base_cost: number;
  cost_per_kg: number;
  transit_days: number;
  reliability_score: number;
  carbon_footprint: number;
  currency: string;
  calculated_price: number;
}

function getSimulatedRoutes(weight_kg: number): Route[] {
  const w = weight_kg || 1;
  const raw = [
    { mode: "Sea" as const, provider: "Maersk Line", cost_per_kg: 0.85, transit_days: 8, reliability_score: 88, carbon_per_kg: 0.042, currency: "USD" },
    { mode: "Sea" as const, provider: "CMA CGM", cost_per_kg: 0.78, transit_days: 9, reliability_score: 85, carbon_per_kg: 0.045, currency: "USD" },
    { mode: "Air" as const, provider: "DHL Express", cost_per_kg: 4.80, transit_days: 2, reliability_score: 96, carbon_per_kg: 0.36, currency: "USD" },
    { mode: "Air" as const, provider: "Royal Air Maroc Cargo", cost_per_kg: 3.90, transit_days: 3, reliability_score: 91, carbon_per_kg: 0.33, currency: "USD" },
    { mode: "Road" as const, provider: "TransMaghreb Trucking", cost_per_kg: 1.20, transit_days: 3, reliability_score: 82, carbon_per_kg: 0.095, currency: "USD" },
    { mode: "Road" as const, provider: "Algeciras Express Haulage", cost_per_kg: 1.35, transit_days: 2, reliability_score: 87, carbon_per_kg: 0.088, currency: "USD" },
    { mode: "Rail" as const, provider: "ONCF Freight", cost_per_kg: 0.65, transit_days: 5, reliability_score: 78, carbon_per_kg: 0.035, currency: "USD" },
  ];
  return raw.map(r => ({
    mode: r.mode,
    provider: r.provider,
    base_cost: Math.round(r.cost_per_kg * 1000),
    cost_per_kg: r.cost_per_kg,
    transit_days: r.transit_days,
    reliability_score: r.reliability_score,
    carbon_footprint: Math.round(r.carbon_per_kg * w),
    currency: r.currency,
    calculated_price: Math.round(r.cost_per_kg * w * 100) / 100,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin_city, destination_city, weight_kg, e_factor } = await req.json();
    const eFactor = e_factor ?? 1.0;
    const weight = weight_kg ?? 100;
    const origin = origin_city || "Casablanca";
    const destination = destination_city || "Paris";
    const routes = getSimulatedRoutes(weight);

    // Generate strategic advice via direct Gemini API
    let strategic_advice = "";
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (GEMINI_API_KEY) {
      const riskContext = eFactor > 1.2
        ? "CRITICAL: Maritime E-Factor is above 1.2, indicating severe weather risk at Moroccan ports (high winds >25 knots, potential port shutdowns). Sea routes are HIGH RISK. Strongly recommend Air or Road alternatives."
        : eFactor > 1.1
          ? "MODERATE: Maritime E-Factor is elevated above 1.1. Some weather disruption possible. Consider reliability tradeoffs."
          : "LOW RISK: Weather conditions are favorable across all modes.";

      // Determine likely transit hubs based on geography
      const originLower = origin.toLowerCase();
      const destLower = destination.toLowerCase();

      let transitHub = "Casablanca Port";
      if (originLower.includes("fes") || originLower.includes("fez") || originLower.includes("tanger") || originLower.includes("tetouan") || originLower.includes("nador") || originLower.includes("oujda")) {
        transitHub = "Tanger Med";
      } else if (originLower.includes("agadir") || originLower.includes("essaouira") || originLower.includes("tiznit") || originLower.includes("taroudant")) {
        transitHub = "Agadir Port";
      } else if (originLower.includes("casablanca") || originLower.includes("rabat") || originLower.includes("kenitra") || originLower.includes("el jadida") || originLower.includes("settat") || originLower.includes("mohammedia")) {
        transitHub = "Casablanca Port";
      } else if (originLower.includes("marrakech") || originLower.includes("beni mellal") || originLower.includes("safi")) {
        transitHub = "Casablanca Port";
      }

      // For European destinations, Tanger Med is often optimal
      const isEurope = ["paris", "london", "berlin", "madrid", "rome", "amsterdam", "brussels", "barcelona", "marseille", "hamburg", "frankfurt", "milan", "lyon", "munich", "vienna", "zurich", "lisbon", "porto"].some(c => destLower.includes(c));
      if (isEurope && !originLower.includes("agadir")) {
        transitHub = "Tanger Med";
      }

      const prompt = `You are a senior logistics consultant specializing in Moroccan exports. Provide a 3-4 sentence strategic recommendation for this specific shipment.

SHIPMENT DETAILS:
- Origin: ${origin}, Morocco
- Destination: ${destination}
- Weight: ${weight}kg
- E-Factor: ×${eFactor.toFixed(2)}
- Identified Transit Hub: ${transitHub}

WEATHER & RISK CONTEXT:
${riskContext}

AVAILABLE ROUTES:
${routes.map(r => `- ${r.mode} (${r.provider}): $${r.calculated_price} total for ${weight}kg, ${r.transit_days} days transit, ${r.reliability_score}% reliability`).join("\n")}

INSTRUCTIONS:
1. Start by explicitly naming the transit port/hub (${transitHub}) and explain WHY it's the logical hub for ${origin} → ${destination}.
2. If E-Factor > 1.2, warn about specific weather conditions at ${transitHub} (e.g., "Heavy winds at ${transitHub}") and recommend an alternative mode with specific cost comparison.
3. Include a percentage cost comparison between the cheapest and recommended options (e.g., "Road is 15% cheaper than Air while maintaining a 3-day ETA").
4. For packages under 100kg, note that Air may be more cost-effective despite higher per-kg rates due to faster clearance.

Respond with ONLY the recommendation text. Be specific about the route, numbers, and transit hub.`;

      try {
        const aiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          strategic_advice = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else {
          console.error("Gemini API error:", aiResp.status);
          const errText = await aiResp.text();
          console.error(errText);
        }
      } catch (aiErr) {
        console.error("AI call failed:", aiErr);
      }
    }

    if (!strategic_advice) {
      strategic_advice = eFactor > 1.2
        ? `Due to critical maritime weather risk (E-Factor ×${eFactor.toFixed(2)}), we recommend switching to Road or Air transport to avoid port delays. For ${origin} to ${destination} (${weight}kg), Road via Algeciras offers the best balance of cost and reliability.`
        : `Current conditions are favorable for ${origin} to ${destination}. Sea freight offers the best cost-efficiency for ${weight}kg shipments. Rail via ONCF is the cheapest option at $${(0.65 * weight).toFixed(2)} if transit time permits.`;
    }

    return new Response(JSON.stringify({ routes, strategic_advice }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fetch-logistics-rates error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
