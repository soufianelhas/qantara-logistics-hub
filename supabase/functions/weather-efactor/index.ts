import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Moroccan port coordinates
const PORTS: Record<string, { lat: number; lon: number; name: string }> = {
  "tanger-med": { lat: 35.8833, lon: -5.5000, name: "Tanger Med" },
  "casablanca":  { lat: 33.6000, lon: -7.6164, name: "Casablanca" },
  "agadir":      { lat: 30.4300, lon: -9.6000, name: "Agadir" },
};

interface PortWeather {
  port: string;
  portName: string;
  windSpeedKnots: number;
  visibility: number;
  hasStormAlert: boolean;
  weatherDescription: string;
  temperature: number;
}

interface EFactorResult {
  ports: PortWeather[];
  portCongestion: "low" | "medium" | "high" | "critical";
  stormRisk: "none" | "low" | "moderate" | "severe";
  multiplier: number;
  breakdown: {
    base: number;
    windContribution: number;
    congestionContribution: number;
    totalDelayDays: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENWEATHER_API_KEY = Deno.env.get("OPENWEATHER_API_KEY");
    if (!OPENWEATHER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENWEATHER_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch weather for all 3 ports in parallel
    const portEntries = Object.entries(PORTS);
    const weatherPromises = portEntries.map(async ([key, port]) => {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${port.lat}&lon=${port.lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`OpenWeather error for ${port.name}:`, resp.status, await resp.text());
        return null;
      }
      const data = await resp.json();
      
      // Wind speed from m/s to knots (1 m/s ≈ 1.944 knots)
      const windSpeedKnots = Math.round((data.wind?.speed ?? 0) * 1.944 * 10) / 10;
      const visibility = data.visibility ?? 10000; // metres
      const weatherId = data.weather?.[0]?.id ?? 800;
      // Storm alert: thunderstorm (2xx), heavy rain (502+), extreme conditions (762+)
      const hasStormAlert = (weatherId >= 200 && weatherId < 300) || (weatherId >= 502 && weatherId < 600) || (weatherId >= 762 && weatherId < 800);
      const weatherDescription = data.weather?.[0]?.description ?? "clear";
      const temperature = data.main?.temp ?? 20;

      return {
        port: key,
        portName: port.name,
        windSpeedKnots,
        visibility,
        hasStormAlert,
        weatherDescription,
        temperature,
      } as PortWeather;
    });

    const portWeatherResults = (await Promise.all(weatherPromises)).filter(Boolean) as PortWeather[];

    if (portWeatherResults.length === 0) {
      return new Response(
        JSON.stringify({ error: "Could not fetch weather data for any port" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── E-Factor Algorithm ──────────────────────────────────────────
    let base = 1.0;
    let windContribution = 0;
    let congestionContribution = 0;

    // Wind contribution: max wind across ports
    const maxWind = Math.max(...portWeatherResults.map(p => p.windSpeedKnots));
    if (maxWind > 25) {
      windContribution = 0.2; // Port shutdown risk
    } else if (maxWind > 18) {
      windContribution = 0.08;
    } else if (maxWind > 12) {
      windContribution = 0.03;
    }

    // Storm contribution
    const stormCount = portWeatherResults.filter(p => p.hasStormAlert).length;

    // Low visibility contribution (< 1km at any port)
    const lowVisCount = portWeatherResults.filter(p => p.visibility < 1000).length;

    // Port congestion: simulated from weather severity (Portcast/GoComet structure)
    // Estimated delay days based on conditions
    let estimatedDelayDays = 0;
    if (maxWind > 25) estimatedDelayDays += 2;
    else if (maxWind > 18) estimatedDelayDays += 1;
    if (stormCount > 0) estimatedDelayDays += stormCount;
    if (lowVisCount > 0) estimatedDelayDays += 0.5 * lowVisCount;

    // +0.05 per day of delay (Portcast/GoComet structure)
    congestionContribution = Math.round(estimatedDelayDays * 0.05 * 10000) / 10000;

    // Determine congestion level
    let portCongestion: EFactorResult["portCongestion"] = "low";
    if (estimatedDelayDays >= 4) portCongestion = "critical";
    else if (estimatedDelayDays >= 2) portCongestion = "high";
    else if (estimatedDelayDays >= 1) portCongestion = "medium";

    // Determine storm risk
    let stormRisk: EFactorResult["stormRisk"] = "none";
    if (stormCount >= 2 || maxWind > 25) stormRisk = "severe";
    else if (stormCount >= 1 || maxWind > 18) stormRisk = "moderate";
    else if (maxWind > 12) stormRisk = "low";

    const multiplier = Math.round((base + windContribution + congestionContribution) * 10000) / 10000;

    const result: EFactorResult = {
      ports: portWeatherResults,
      portCongestion,
      stormRisk,
      multiplier,
      breakdown: {
        base,
        windContribution,
        congestionContribution,
        totalDelayDays: estimatedDelayDays,
      },
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("weather-efactor error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
