import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  Wind,
  Anchor,
  AlertTriangle,
  TrendingUp,
  Save,
  RefreshCw,
  CloudLightning,
  Ship,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ---- Types ----------------------------------------------------------------

interface CostInputs {
  productName: string;
  hsCode: string;
  productValue: string;   // V
  freight: string;        // F
  insurance: string;      // I
  duty: string;           // D
  taxes: string;          // T
}

interface EFactorData {
  portCongestion: "low" | "medium" | "high" | "critical";
  stormRisk: "none" | "low" | "moderate" | "severe";
  multiplier: number;
}

interface CalculationResult {
  v: number;
  f: number;
  i: number;
  d: number;
  t: number;
  eFactor: number;
  optimistic: number;    // V+F+I+D+T
  realistic: number;     // optimistic × E-factor
  difference: number;
}

// ---- E-Factor simulation -------------------------------------------------

const PORT_CONGESTION_LEVELS = {
  low:      { label: "Low",      color: "text-risk-low",    bg: "bg-risk-low/10",    multiplierContrib: 0.00 },
  medium:   { label: "Medium",   color: "text-risk-medium", bg: "bg-risk-medium/10", multiplierContrib: 0.05 },
  high:     { label: "High",     color: "text-risk-high",   bg: "bg-risk-high/10",   multiplierContrib: 0.12 },
  critical: { label: "Critical", color: "text-risk-high",   bg: "bg-risk-high/10",   multiplierContrib: 0.22 },
};

const STORM_RISK_LEVELS = {
  none:     { label: "None",     color: "text-risk-low",    bg: "bg-risk-low/10",    multiplierContrib: 0.00 },
  low:      { label: "Low",      color: "text-risk-low",    bg: "bg-risk-low/10",    multiplierContrib: 0.02 },
  moderate: { label: "Moderate", color: "text-risk-medium", bg: "bg-risk-medium/10", multiplierContrib: 0.08 },
  severe:   { label: "Severe",   color: "text-risk-high",   bg: "bg-risk-high/10",   multiplierContrib: 0.18 },
};

function simulateEFactor(): EFactorData {
  // Simulate PortNet query (random for demo)
  const congestionKeys: Array<EFactorData["portCongestion"]> = ["low", "medium", "high", "critical"];
  const stormKeys: Array<EFactorData["stormRisk"]> = ["none", "low", "moderate", "severe"];
  const portCongestion = congestionKeys[Math.floor(Math.random() * congestionKeys.length)];
  const stormRisk = stormKeys[Math.floor(Math.random() * stormKeys.length)];
  const baseMultiplier = 1.0;
  const multiplier =
    baseMultiplier +
    PORT_CONGESTION_LEVELS[portCongestion].multiplierContrib +
    STORM_RISK_LEVELS[stormRisk].multiplierContrib;
  return { portCongestion, stormRisk, multiplier: parseFloat(multiplier.toFixed(4)) };
}

// ---- Helpers --------------------------------------------------------------

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function pct(diff: number, base: number) {
  if (base === 0) return "0%";
  return `+${((diff / base) * 100).toFixed(1)}%`;
}

// ---- Main component -------------------------------------------------------

const DEFAULT_INPUTS: CostInputs = {
  productName: "",
  hsCode: "",
  productValue: "",
  freight: "",
  insurance: "",
  duty: "",
  taxes: "",
};

export default function LandedCostEngine() {
  const [inputs, setInputs] = useState<CostInputs>(DEFAULT_INPUTS);
  const [eFactor, setEFactor] = useState<EFactorData | null>(null);
  const [eFactorLoading, setEFactorLoading] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleChange = (field: keyof CostInputs, value: string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
    // Reset calculation on input change
    setResult(null);
  };

  const handleSimulateEFactor = async () => {
    setEFactorLoading(true);
    setEFactor(null);
    // Simulate async API call
    await new Promise((r) => setTimeout(r, 1400));
    const data = simulateEFactor();
    setEFactor(data);
    setEFactorLoading(false);
    toast({
      title: "E-Factor Assessed",
      description: `PortNet & weather data processed. Multiplier: ×${data.multiplier}`,
    });
  };

  const handleCalculate = () => {
    const v = parseFloat(inputs.productValue) || 0;
    const f = parseFloat(inputs.freight) || 0;
    const i = parseFloat(inputs.insurance) || 0;
    const d = parseFloat(inputs.duty) || 0;
    const t = parseFloat(inputs.taxes) || 0;
    const e = eFactor?.multiplier ?? 1.0;
    const optimistic = v + f + i + d + t;
    const realistic = optimistic * e;
    setResult({
      v, f, i, d, t,
      eFactor: e,
      optimistic,
      realistic,
      difference: realistic - optimistic,
    });
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Authentication required", description: "Please sign in to save shipments.", variant: "destructive" });
        setSaving(false);
        return;
      }
      const { error } = await supabase.from("shipments").insert({
        user_id: user.id,
        product_name: inputs.productName || "Unnamed Product",
        raw_cost_v: result.v,
        freight: result.f,
        insurance: result.i,
        duty: result.d,
        taxes: result.t,
        e_factor_multiplier: result.eFactor,
        hs_code_assigned: inputs.hsCode || null,
        port_congestion_level: eFactor?.portCongestion ?? null,
        weather_risk_level: eFactor?.stormRisk ?? null,
        status: "Calculated",
      });
      if (error) throw error;
      toast({ title: "Shipment saved!", description: "Cost calculation stored in your database." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setInputs(DEFAULT_INPUTS);
    setEFactor(null);
    setResult(null);
  };

  const congestionInfo = eFactor ? PORT_CONGESTION_LEVELS[eFactor.portCongestion] : null;
  const stormInfo = eFactor ? STORM_RISK_LEVELS[eFactor.stormRisk] : null;

  return (
    <AppLayout title="Landed Cost Engine" subtitle="Total import cost calculator — V+F+I+D+T × E-factor">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Cost Inputs ─────────────────────────────────────────────────── */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Calculator className="w-3.5 h-3.5 text-primary" />
              </div>
              Cost Inputs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Product info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Product Name</Label>
                <Input
                  placeholder="e.g. Argan Oil — 250ml"
                  value={inputs.productName}
                  onChange={(e) => handleChange("productName", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">HS Code</Label>
                <Input
                  placeholder="e.g. 1515.30"
                  value={inputs.hsCode}
                  onChange={(e) => handleChange("hsCode", e.target.value)}
                />
              </div>
            </div>

            {/* Formula fields */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {(
                [
                  { key: "productValue", label: "V — Product Value", placeholder: "0.00" },
                  { key: "freight",      label: "F — Freight",        placeholder: "0.00" },
                  { key: "insurance",    label: "I — Insurance",       placeholder: "0.00" },
                  { key: "duty",         label: "D — Duty",            placeholder: "0.00" },
                  { key: "taxes",        label: "T — Taxes",           placeholder: "0.00" },
                ] as { key: keyof CostInputs; label: string; placeholder: string }[]
              ).map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">
                    {label}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={placeholder}
                      value={inputs[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="pl-6"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Formula reminder */}
            <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 flex items-center gap-3">
              <span className="font-mono text-xs text-primary font-semibold">Total = V + F + I + D + T</span>
              <span className="text-muted-foreground text-xs">×</span>
              <span className="font-mono text-xs text-foreground font-semibold">E-Factor</span>
              <Badge variant="outline" className="ml-auto text-xs border-primary/30 text-primary">
                Moroccan Export Standard
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ── E-Factor Section ─────────────────────────────────────────────── */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="w-7 h-7 rounded-lg bg-risk-high/10 border border-risk-high/20 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-risk-high" />
              </div>
              E-Factor — Risk Multiplier
              <Badge variant="outline" className="ml-auto text-xs border-border">
                Simulated: PortNet + OpenWeather
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              The E-Factor queries real-time port congestion data from <strong className="text-foreground">PortNet Morocco</strong> and
              storm/weather alerts from <strong className="text-foreground">OpenWeather API</strong>. It acts as a risk multiplier on your
              total landed cost, representing operational uncertainty at Moroccan export ports.
            </p>

            <Button
              onClick={handleSimulateEFactor}
              disabled={eFactorLoading}
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/5"
            >
              {eFactorLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Querying PortNet & OpenWeather…
                </>
              ) : (
                <>
                  <Ship className="w-3.5 h-3.5" />
                  Simulate E-Factor Assessment
                </>
              )}
            </Button>

            {eFactor && congestionInfo && stormInfo && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                {/* Port Congestion */}
                <div className={`rounded-lg border p-4 space-y-2 ${congestionInfo.bg} border-border`}>
                  <div className="flex items-center gap-2">
                    <Anchor className={`w-4 h-4 ${congestionInfo.color}`} />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Port Congestion</span>
                  </div>
                  <p className={`text-lg font-bold ${congestionInfo.color}`}>{congestionInfo.label}</p>
                  <p className="text-xs text-muted-foreground">Tanger Med / Casablanca port load index</p>
                </div>

                {/* Storm Risk */}
                <div className={`rounded-lg border p-4 space-y-2 ${stormInfo.bg} border-border`}>
                  <div className="flex items-center gap-2">
                    <CloudLightning className={`w-4 h-4 ${stormInfo.color}`} />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Storm Risk</span>
                  </div>
                  <p className={`text-lg font-bold ${stormInfo.color}`}>{stormInfo.label}</p>
                  <p className="text-xs text-muted-foreground">Atlantic weather alert level</p>
                </div>

                {/* Final Multiplier */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">E-Factor</span>
                  </div>
                  <p className="text-2xl font-bold text-primary font-mono">×{eFactor.multiplier.toFixed(4)}</p>
                  <p className="text-xs text-muted-foreground">
                    Cost premium: +{(((eFactor.multiplier - 1) * 100)).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Action Row ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleCalculate}
            disabled={!inputs.productValue}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Calculator className="w-4 h-4" />
            Calculate Landed Cost
          </Button>
          {result && (
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/5"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Shipment"}
            </Button>
          )}
          <Button
            onClick={handleReset}
            variant="ghost"
            className="text-muted-foreground hover:text-foreground ml-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </Button>
        </div>

        {/* ── Comparison Table ─────────────────────────────────────────────── */}
        {result && (
          <Card className="border-border shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                </div>
                Cost Breakdown — Optimistic vs Realistic
                {inputs.productName && (
                  <Badge variant="outline" className="ml-auto text-xs border-border font-normal">
                    {inputs.productName}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Component
                      </th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Value
                      </th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-primary uppercase tracking-wide bg-primary/5 rounded-t-md">
                        Optimistic
                      </th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-risk-high uppercase tracking-wide bg-risk-high/5 rounded-t-md">
                        Realistic (×E)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        { label: "V — Product Value",  value: result.v },
                        { label: "F — Freight",         value: result.f },
                        { label: "I — Insurance",        value: result.i },
                        { label: "D — Duty",             value: result.d },
                        { label: "T — Taxes",            value: result.t },
                      ] as { label: string; value: number }[]
                    ).map(({ label, value }) => (
                      <tr key={label} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-foreground">{label}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground">{fmt(value)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground bg-primary/3">{fmt(value)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground bg-risk-high/3">
                          {fmt(value * result.eFactor)}
                        </td>
                      </tr>
                    ))}

                    {/* E-Factor row */}
                    <tr className="border-b border-border/50 bg-muted/20">
                      <td className="py-2.5 px-3 text-muted-foreground italic">E-Factor Multiplier</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">×{result.eFactor.toFixed(4)}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground text-xs bg-primary/3">Not applied</td>
                      <td className="py-2.5 px-3 text-right font-mono text-risk-high bg-risk-high/3">
                        ×{result.eFactor.toFixed(4)}
                      </td>
                    </tr>

                    {/* Totals */}
                    <tr className="bg-muted/40 font-semibold">
                      <td className="py-3.5 px-3 text-foreground font-bold">TOTAL LANDED COST</td>
                      <td className="py-3.5 px-3"></td>
                      <td className="py-3.5 px-3 text-right font-mono text-primary text-base bg-primary/8">
                        {fmt(result.optimistic)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-risk-high text-base bg-risk-high/8">
                        {fmt(result.realistic)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Risk premium callout */}
              {result.difference > 0 && (
                <div className="mt-4 rounded-lg border border-risk-high/25 bg-risk-high/8 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-risk-high mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      E-Factor Risk Premium: {fmt(result.difference)}{" "}
                      <span className="text-risk-high">({pct(result.difference, result.optimistic)} above base cost)</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This premium accounts for port congestion delays and weather disruptions at Moroccan export terminals.
                    </p>
                  </div>
                </div>
              )}

              {result.eFactor === 1.0 && (
                <div className="mt-4 rounded-lg border border-risk-low/25 bg-risk-low/8 px-4 py-3 flex items-center gap-3">
                  <Wind className="w-4 h-4 text-risk-low" />
                  <p className="text-xs text-muted-foreground">
                    No E-Factor risk applied. Run the E-Factor Assessment above for a more accurate realistic cost.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
