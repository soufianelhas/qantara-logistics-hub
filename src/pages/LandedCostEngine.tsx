import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { WorkflowStepper } from "@/components/WorkflowStepper";
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
  Lock,
  Brain,
  FileCheck,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EFactorData {
  portCongestion: "low" | "medium" | "high" | "critical";
  stormRisk: "none" | "low" | "moderate" | "severe";
  multiplier: number;
}

interface CalculationResult {
  v: number; f: number; i: number; d: number; t: number;
  eFactor: number;
  optimistic: number;
  realistic: number;
  difference: number;
}

// ── E-Factor simulation ───────────────────────────────────────────────────────

const PORT_CONGESTION = {
  low:      { label: "Low",      color: "text-risk-low",    bg: "bg-risk-low/10",    contrib: 0.00 },
  medium:   { label: "Medium",   color: "text-risk-medium", bg: "bg-risk-medium/10", contrib: 0.05 },
  high:     { label: "High",     color: "text-risk-high",   bg: "bg-risk-high/10",   contrib: 0.12 },
  critical: { label: "Critical", color: "text-risk-high",   bg: "bg-risk-high/10",   contrib: 0.22 },
};

const STORM_RISK = {
  none:     { label: "None",     color: "text-risk-low",    bg: "bg-risk-low/10",    contrib: 0.00 },
  low:      { label: "Low",      color: "text-risk-low",    bg: "bg-risk-low/10",    contrib: 0.02 },
  moderate: { label: "Moderate", color: "text-risk-medium", bg: "bg-risk-medium/10", contrib: 0.08 },
  severe:   { label: "Severe",   color: "text-risk-high",   bg: "bg-risk-high/10",   contrib: 0.18 },
};

function simulateEFactor(): EFactorData {
  const congestionKeys = ["low", "medium", "high", "critical"] as const;
  const stormKeys = ["none", "low", "moderate", "severe"] as const;
  const portCongestion = congestionKeys[Math.floor(Math.random() * congestionKeys.length)];
  const stormRisk = stormKeys[Math.floor(Math.random() * stormKeys.length)];
  const multiplier = parseFloat(
    (1 + PORT_CONGESTION[portCongestion].contrib + STORM_RISK[stormRisk].contrib).toFixed(4)
  );
  return { portCongestion, stormRisk, multiplier };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandedCostEngine() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Read params from HS Navigator
  const fromClassifier = searchParams.get("from") === "classifier";
  const paramHsCode     = searchParams.get("hs_code") || "";
  const paramDuty       = parseFloat(searchParams.get("duty") || "0");
  const paramTax        = parseFloat(searchParams.get("tax") || "0");
  const paramProduct    = searchParams.get("product_name") || "";
  const paramConfidence = searchParams.get("confidence") || "";

  // User-editable fields (only V, F, I unlocked when coming from classifier)
  const [productName,  setProductName]  = useState(paramProduct);
  const [hsCode,       setHsCode]       = useState(paramHsCode);
  const [productValue, setProductValue] = useState("");  // V
  const [freight,      setFreight]      = useState("");  // F
  const [insurance,    setInsurance]    = useState("");  // I
  // D and T are pre-filled from TARIC when fromClassifier
  const [duty,         setDuty]         = useState(fromClassifier ? String(paramDuty) : "");   // D
  const [taxes,        setTaxes]        = useState(fromClassifier ? String(paramTax)  : "");   // T

  const [eFactor,       setEFactor]       = useState<EFactorData | null>(null);
  const [eFactorLoading,setEFactorLoading]= useState(false);
  const [result,        setResult]        = useState<CalculationResult | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);

  // Re-sync if search params change (e.g., browser back/forward)
  useEffect(() => {
    setProductName(paramProduct);
    setHsCode(paramHsCode);
    setDuty(fromClassifier ? String(paramDuty) : "");
    setTaxes(fromClassifier ? String(paramTax)  : "");
    setProductValue("");
    setFreight("");
    setInsurance("");
    setEFactor(null);
    setResult(null);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramHsCode]);

  // ── E-Factor ──────────────────────────────────────────────────────────────

  const handleSimulateEFactor = async () => {
    setEFactorLoading(true);
    setEFactor(null);
    await new Promise((r) => setTimeout(r, 1400));
    const data = simulateEFactor();
    setEFactor(data);
    setEFactorLoading(false);
    toast({ title: "E-Factor Assessed", description: `Multiplier: ×${data.multiplier}` });
  };

  // ── Calculate ─────────────────────────────────────────────────────────────

  const handleCalculate = () => {
    const v = parseFloat(productValue) || 0;
    const f = parseFloat(freight)       || 0;
    const i = parseFloat(insurance)     || 0;
    const d = parseFloat(duty)          || 0;
    const t = parseFloat(taxes)         || 0;

    // D and T are % of V when coming from TARIC (convert to absolute values)
    const dAbsolute = fromClassifier ? (v * d) / 100 : d;
    const tAbsolute = fromClassifier ? (v * t) / 100 : t;

    const e = eFactor?.multiplier ?? 1.0;
    const optimistic = v + f + i + dAbsolute + tAbsolute;
    const realistic  = optimistic * e;
    setResult({
      v, f, i,
      d: dAbsolute,
      t: tAbsolute,
      eFactor: e,
      optimistic,
      realistic,
      difference: realistic - optimistic,
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Sign in required", description: "Please sign in to save shipments.", variant: "destructive" });
        setSaving(false);
        return;
      }
      const { error } = await supabase.from("shipments").insert({
        user_id:             user.id,
        product_name:        productName || paramProduct || "Unnamed Product",
        raw_cost_v:          result.v,
        freight:             result.f,
        insurance:           result.i,
        duty:                result.d,
        taxes:               result.t,
        e_factor_multiplier: result.eFactor,
        hs_code_assigned:    hsCode || null,
        port_congestion_level: eFactor?.portCongestion ?? null,
        weather_risk_level:    eFactor?.stormRisk ?? null,
        status:              "Calculated",
      });
      if (error) throw error;
      setSaved(true);
      toast({ title: "Shipment saved!", description: "Compound record stored in your database." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Form reset ────────────────────────────────────────────────────────────

  const handleReset = () => {
    setProductValue(""); setFreight(""); setInsurance("");
    if (!fromClassifier) { setDuty(""); setTaxes(""); setHsCode(""); setProductName(""); }
    setEFactor(null); setResult(null); setSaved(false);
  };

  const congestionInfo = eFactor ? PORT_CONGESTION[eFactor.portCongestion] : null;
  const stormInfo      = eFactor ? STORM_RISK[eFactor.stormRisk]           : null;

  // Step: 3 if saved, else 2
  const workflowStep: 1 | 2 | 3 = saved ? 3 : 2;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout title="Landed Cost Engine" subtitle="V + F + I + D + T × E-Factor">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Stepper (only shown in compound flow) ──────────────────────── */}
        {fromClassifier && <WorkflowStepper currentStep={workflowStep} />}

        {/* ── Provenance banner (from HS Navigator) ──────────────────────── */}
        {fromClassifier && (
          <div className="rounded-xl border border-primary/20 bg-primary/6 px-4 py-3.5 flex items-center gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">
                Data transferred from HS Neural-Navigator
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                HS code{" "}
                <span className="font-mono font-bold text-foreground">{paramHsCode}</span>
                {" · "}Duty <strong className="text-foreground">{paramDuty}%</strong>
                {" · "}Tax <strong className="text-foreground">{paramTax}%</strong>
                {paramConfidence && (
                  <> · Match confidence <strong className="text-foreground">{paramConfidence}%</strong></>
                )}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary shrink-0">
              Auto-filled
            </Badge>
            <button
              onClick={() => navigate("/hs-navigator")}
              className="ml-2 shrink-0 text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Back
            </button>
          </div>
        )}

        {/* ── Cost Inputs ─────────────────────────────────────────────────── */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Calculator className="w-3.5 h-3.5 text-primary" />
              </div>
              Cost Inputs
              {fromClassifier && (
                <Badge variant="outline" className="ml-auto text-[10px] border-border text-muted-foreground font-normal gap-1">
                  <Lock className="w-2.5 h-2.5" /> D & T pre-filled from TARIC
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Product meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Product Name
                </Label>
                <Input
                  placeholder="e.g. Argan Oil — 250ml"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  HS Code
                </Label>
                <Input
                  placeholder="e.g. 1515.30"
                  value={hsCode}
                  onChange={(e) => setHsCode(e.target.value)}
                  readOnly={fromClassifier}
                  className={cn(fromClassifier && "bg-muted/50 text-muted-foreground cursor-default")}
                />
              </div>
            </div>

            {/* VFIDT fields grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* V — Product Value (USER INPUT) */}
              <CostField
                label="V — Product Value"
                placeholder="0.00"
                value={productValue}
                onChange={setProductValue}
                userInput
              />

              {/* F — Freight (USER INPUT) */}
              <CostField
                label="F — Freight Cost"
                placeholder="0.00"
                value={freight}
                onChange={setFreight}
                userInput
              />

              {/* I — Insurance (USER INPUT) */}
              <CostField
                label="I — Insurance"
                placeholder="0.00"
                value={insurance}
                onChange={setInsurance}
                userInput
              />

              {/* D — Duty (auto-filled from TARIC when compound) */}
              <CostField
                label="D — Duty Rate"
                placeholder="0.00"
                value={duty}
                onChange={setDuty}
                locked={fromClassifier}
                suffix={fromClassifier ? `% of V` : undefined}
                hint={fromClassifier ? "TARIC rate" : undefined}
              />

              {/* T — Tax (auto-filled from TARIC when compound) */}
              <CostField
                label="T — Tax Rate"
                placeholder="0.00"
                value={taxes}
                onChange={setTaxes}
                locked={fromClassifier}
                suffix={fromClassifier ? `% of V` : undefined}
                hint={fromClassifier ? "TARIC rate" : undefined}
              />
            </div>

            {/* Formula banner */}
            <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-2.5 flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs text-primary font-semibold">
                Total = V + F + I + D + T
              </span>
              <span className="text-muted-foreground text-xs">×</span>
              <span className="font-mono text-xs text-foreground font-semibold">E-Factor</span>
              {fromClassifier && (
                <Badge variant="outline" className="ml-auto text-[10px] border-primary/25 text-primary gap-1">
                  <Brain className="w-2.5 h-2.5" /> TARIC Compound Record
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── E-Factor ────────────────────────────────────────────────────── */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="w-7 h-7 rounded-lg bg-risk-high/10 border border-risk-high/20 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-risk-high" />
              </div>
              E-Factor — Risk Multiplier
              <Badge variant="outline" className="ml-auto text-xs border-border">
                PortNet + OpenWeather (simulated)
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Simulates real-time port congestion from <strong className="text-foreground">PortNet Morocco</strong> and
              storm alerts from <strong className="text-foreground">OpenWeather API</strong> to compute a risk
              multiplier on your total landed cost.
            </p>
            <Button
              onClick={handleSimulateEFactor}
              disabled={eFactorLoading}
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/5"
            >
              {eFactorLoading ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Querying PortNet & OpenWeather…</>
              ) : (
                <><Ship className="w-3.5 h-3.5" /> Simulate E-Factor Assessment</>
              )}
            </Button>

            {eFactor && congestionInfo && stormInfo && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                <div className={cn("rounded-lg border p-4 space-y-2 border-border", congestionInfo.bg)}>
                  <div className="flex items-center gap-2">
                    <Anchor className={cn("w-4 h-4", congestionInfo.color)} />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Port Congestion</span>
                  </div>
                  <p className={cn("text-lg font-bold", congestionInfo.color)}>{congestionInfo.label}</p>
                  <p className="text-xs text-muted-foreground">Tanger Med / Casablanca</p>
                </div>
                <div className={cn("rounded-lg border p-4 space-y-2 border-border", stormInfo.bg)}>
                  <div className="flex items-center gap-2">
                    <CloudLightning className={cn("w-4 h-4", stormInfo.color)} />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Storm Risk</span>
                  </div>
                  <p className={cn("text-lg font-bold", stormInfo.color)}>{stormInfo.label}</p>
                  <p className="text-xs text-muted-foreground">Atlantic weather alert</p>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">E-Factor</span>
                  </div>
                  <p className="text-2xl font-bold text-primary font-mono">×{eFactor.multiplier.toFixed(4)}</p>
                  <p className="text-xs text-muted-foreground">
                    Premium: +{((eFactor.multiplier - 1) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Action Row ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleCalculate}
            disabled={!productValue}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Calculator className="w-4 h-4" />
            Calculate Landed Cost
          </Button>
          {result && !saved && (
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
          {saved && (
            <div className="flex items-center gap-2 text-sm text-risk-low font-medium animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              Saved to database
            </div>
          )}
          <Button onClick={handleReset} variant="ghost" className="text-muted-foreground hover:text-foreground ml-auto">
            <RefreshCw className="w-4 h-4" />
            Reset
          </Button>
        </div>

        {/* ── Comparison Table ─────────────────────────────────────────────── */}
        {result && (
          <Card className="border-border shadow-card animate-fade-in">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                </div>
                Cost Breakdown — Optimistic vs Realistic
                {productName && (
                  <Badge variant="outline" className="ml-auto text-xs border-border font-normal">
                    {productName}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Component</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-primary uppercase tracking-wide bg-primary/5 rounded-t">Optimistic</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-risk-high uppercase tracking-wide bg-risk-high/5 rounded-t">Realistic (×E)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      { label: "V — Product Value", value: result.v },
                      { label: "F — Freight",        value: result.f },
                      { label: "I — Insurance",       value: result.i },
                      { label: `D — Duty${fromClassifier ? ` (${paramDuty}%)` : ""}`,  value: result.d },
                      { label: `T — Tax${fromClassifier ? ` (${paramTax}%)`  : ""}`,   value: result.t },
                    ] as { label: string; value: number }[]).map(({ label, value }) => (
                      <tr key={label} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-foreground">{label}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground">{fmt(value)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground bg-primary/3">{fmt(value)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground bg-risk-high/3">{fmt(value * result.eFactor)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-border/50 bg-muted/20">
                      <td className="py-2.5 px-3 text-muted-foreground italic">E-Factor Multiplier</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">×{result.eFactor.toFixed(4)}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground text-xs bg-primary/3">Not applied</td>
                      <td className="py-2.5 px-3 text-right font-mono text-risk-high bg-risk-high/3">×{result.eFactor.toFixed(4)}</td>
                    </tr>
                    <tr className="bg-muted/40 font-semibold">
                      <td className="py-3.5 px-3 text-foreground font-bold">TOTAL LANDED COST</td>
                      <td className="py-3.5 px-3" />
                      <td className="py-3.5 px-3 text-right font-mono text-primary text-base bg-primary/8">{fmt(result.optimistic)}</td>
                      <td className="py-3.5 px-3 text-right font-mono text-risk-high text-base bg-risk-high/8">{fmt(result.realistic)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {result.difference > 0 && (
                <div className="mt-4 rounded-lg border border-risk-high/25 bg-risk-high/8 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-risk-high mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      E-Factor Risk Premium: {fmt(result.difference)}{" "}
                      <span className="text-risk-high">
                        (+{result.optimistic > 0 ? ((result.difference / result.optimistic) * 100).toFixed(1) : "0"}% above base cost)
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Accounts for port congestion delays and weather disruptions at Moroccan export terminals.
                    </p>
                  </div>
                </div>
              )}

              {result.eFactor === 1.0 && (
                <div className="mt-4 rounded-lg border border-risk-low/25 bg-risk-low/8 px-4 py-3 flex items-center gap-3">
                  <Wind className="w-4 h-4 text-risk-low" />
                  <p className="text-xs text-muted-foreground">
                    No E-Factor applied. Run the assessment above for a realistic cost projection.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Finalize Banner ───────────────────────────────────────── */}
        {saved && fromClassifier && (
          <div className="animate-fade-in rounded-xl border border-risk-low/25 bg-risk-low/8 p-5 flex items-start gap-4">
            <div className="w-9 h-9 rounded-full bg-risk-low/20 border border-risk-low/30 flex items-center justify-center shrink-0">
              <FileCheck className="w-4.5 h-4.5 text-risk-low" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Compound record saved — Step 3: Finalize</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                HS code <span className="font-mono font-bold text-foreground">{hsCode}</span> with
                status <Badge variant="outline" className="text-[10px] ml-1">Calculated</Badge> stored in your shipments database.
                Proceed to the Authenticity Studio to validate export documents.
              </p>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

// ── CostField sub-component ───────────────────────────────────────────────────

interface CostFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  locked?: boolean;
  userInput?: boolean;
  suffix?: string;
  hint?: string;
}

function CostField({ label, placeholder, value, onChange, locked, userInput, suffix, hint }: CostFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">
          {label}
        </Label>
        {locked && (
          <Lock className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
        )}
        {userInput && (
          <span className="text-[9px] uppercase tracking-wide text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-sm">
            Input
          </span>
        )}
      </div>
      <div className="relative">
        {!suffix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>}
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={locked}
          className={cn(
            !suffix && "pl-6",
            locked && "bg-muted/50 cursor-default border-dashed text-muted-foreground"
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p className="text-[10px] text-primary/70 font-medium">{hint}</p>
      )}
    </div>
  );
}
