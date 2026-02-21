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
  RefreshCw,
  CloudLightning,
  Ship,
  CheckCircle2,
  Lock,
  Brain,
  FileText,
  ArrowLeft,
  ArrowRight,
  Thermometer,
  Eye,
  Database,
  Truck,
  Plane,
  TrainFront,
  Leaf,
  Sparkles,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useShipmentRecovery } from "@/hooks/use-shipment-recovery";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortWeather {
  port: string;
  portName: string;
  windSpeedKnots: number;
  visibility: number;
  hasStormAlert: boolean;
  weatherDescription: string;
  temperature: number;
}

interface EFactorData {
  portCongestion: "low" | "medium" | "high" | "critical";
  stormRisk: "none" | "low" | "moderate" | "severe";
  multiplier: number;
  ports: PortWeather[];
  breakdown: {
    base: number;
    windContribution: number;
    congestionContribution: number;
    totalDelayDays: number;
  };
}

interface CalculationResult {
  v: number; f: number; i: number; d: number; t: number;
  eFactor: number;
  optimistic: number;
  realistic: number;
  difference: number;
}

interface LogisticsRoute {
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

const MODE_ICON: Record<string, typeof Ship> = { Sea: Ship, Air: Plane, Road: Truck, Rail: TrainFront };
const MODE_ORDER = ["Sea", "Air", "Road", "Rail"];

// ── Styling maps ──────────────────────────────────────────────────────────────

const PORT_CONGESTION = {
  low:      { label: "Low",      color: "text-risk-low",    bg: "bg-risk-low/10",    contrib: 0.00 },
  medium:   { label: "Medium",   color: "text-risk-medium", bg: "bg-risk-medium/10", contrib: 0.05 },
  high:     { label: "High",     color: "text-risk-high",   bg: "bg-risk-high/10",   contrib: 0.12 },
  critical: { label: "Critical", color: "text-risk-high",   bg: "bg-risk-high/10",   contrib: 0.22 },
};

const STORM_RISK = {
  none:     { label: "None",     color: "text-risk-low",    bg: "bg-risk-low/10" },
  low:      { label: "Low",      color: "text-risk-low",    bg: "bg-risk-low/10" },
  moderate: { label: "Moderate", color: "text-risk-medium", bg: "bg-risk-medium/10" },
  severe:   { label: "Severe",   color: "text-risk-high",   bg: "bg-risk-high/10" },
};

const E_FACTOR_RISK_THRESHOLD = 1.15;

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
  const paramShipmentId = searchParams.get("shipment_id") || null;

  // Smart shipment recovery — accept Draft or Calculated so we can resume
  const { shipmentId: recoveredId, shipment: recoveredShipment, loading: recoveryLoading, recovered, setShipmentId: setRecoveredId } = useShipmentRecovery(paramShipmentId, ["Draft", "Calculated"]);
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(paramShipmentId);

  // Sync recovered ID into local active state
  useEffect(() => {
    if (recoveredId && !activeShipmentId) setActiveShipmentId(recoveredId);
  }, [recoveredId]);

  // User-editable fields — restore from localStorage
  const [productName,  setProductName]  = useState(() => paramProduct || localStorage.getItem("qantara_lce_productName") || "");
  const [hsCode,       setHsCode]       = useState(() => paramHsCode || localStorage.getItem("qantara_lce_hsCode") || "");
  const [productValue, setProductValue] = useState(() => localStorage.getItem("qantara_lce_productValue") || "");
  const [freight,      setFreight]      = useState(() => localStorage.getItem("qantara_lce_freight") || "");
  const [insurance,    setInsurance]    = useState(() => localStorage.getItem("qantara_lce_insurance") || "");
  const [duty,         setDuty]         = useState(fromClassifier ? String(paramDuty) : () => localStorage.getItem("qantara_lce_duty") || "");
  const [taxes,        setTaxes]        = useState(fromClassifier ? String(paramTax)  : () => localStorage.getItem("qantara_lce_taxes") || "");

  const [eFactor,        setEFactor]        = useState<EFactorData | null>(null);
  const [eFactorLoading, setEFactorLoading] = useState(false);
  const [result,         setResult]         = useState<CalculationResult | null>(null);
  const [finalizing,     setFinalizing]     = useState(false);

  // Shipment specs state
  const [originCity, setOriginCity] = useState(() => localStorage.getItem("qantara_lce_originCity") || "");
  const [destinationCity, setDestinationCity] = useState(() => localStorage.getItem("qantara_lce_destinationCity") || "");
  const [totalWeightKg, setTotalWeightKg] = useState(() => localStorage.getItem("qantara_lce_totalWeightKg") || "");

  // Route Discovery state
  const [routeDiscoveryOpen, setRouteDiscoveryOpen] = useState(false);
  const [logisticsRates, setLogisticsRates] = useState<LogisticsRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<LogisticsRoute | null>(null);
  const [strategicAdvice, setStrategicAdvice] = useState("");
  // Save form state to localStorage
  useEffect(() => { try { localStorage.setItem("qantara_lce_productName", productName); } catch {} }, [productName]);
  useEffect(() => { try { localStorage.setItem("qantara_lce_hsCode", hsCode); } catch {} }, [hsCode]);
  useEffect(() => { try { localStorage.setItem("qantara_lce_productValue", productValue); } catch {} }, [productValue]);
  useEffect(() => { try { localStorage.setItem("qantara_lce_freight", freight); } catch {} }, [freight]);
  useEffect(() => { try { localStorage.setItem("qantara_lce_insurance", insurance); } catch {} }, [insurance]);
  useEffect(() => { try { localStorage.setItem("qantara_lce_duty", duty); } catch {} }, [duty]);
  useEffect(() => { try { localStorage.setItem("qantara_lce_taxes", taxes); } catch {} }, [taxes]);
  useEffect(() => { try { localStorage.setItem("qantara_lce_originCity", originCity); } catch {} }, [originCity]);
  useEffect(() => { try { localStorage.setItem("qantara_lce_destinationCity", destinationCity); } catch {} }, [destinationCity]);
  useEffect(() => { try { localStorage.setItem("qantara_lce_totalWeightKg", totalWeightKg); } catch {} }, [totalWeightKg]);

  // Load recovered shipment data
  useEffect(() => {
    if (recovered && recoveredShipment && !fromClassifier) {
      if (recoveredShipment.product_name) setProductName(recoveredShipment.product_name);
      if (recoveredShipment.hs_code_assigned) setHsCode(recoveredShipment.hs_code_assigned);
      toast({ title: "Shipment recovered", description: `Resumed: ${recoveredShipment.product_name || "Unnamed"}` });
    }
  }, [recovered, recoveredShipment]);

  useEffect(() => {
    if (!fromClassifier) return;
    setProductName(paramProduct);
    setHsCode(paramHsCode);
    setDuty(String(paramDuty));
    setTaxes(String(paramTax));
  }, [paramHsCode]);

  // ── E-Factor — Real-Time Weather ──────────────────────────────────────────

  const handleFetchEFactor = async () => {
    setEFactorLoading(true);
    setEFactor(null);

    try {
      const { data, error } = await supabase.functions.invoke("weather-efactor");

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setEFactor(data as EFactorData);
      toast({
        title: "E-Factor Assessed — Live Data",
        description: `Multiplier: ×${data.multiplier} (${data.ports?.length || 0} ports queried)`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Weather fetch failed";
      toast({ title: "E-Factor Error", description: msg, variant: "destructive" });
      console.error("E-Factor fetch error:", err);
    } finally {
      setEFactorLoading(false);
    }
  };

  // ── Calculate ─────────────────────────────────────────────────────────────

  const handleCalculate = () => {
    const v = parseFloat(productValue) || 0;
    const f = parseFloat(freight)       || 0;
    const i = parseFloat(insurance)     || 0;
    const d = parseFloat(duty)          || 0;
    const t = parseFloat(taxes)         || 0;

    const dAbsolute = fromClassifier ? (v * d) / 100 : d;
    const tAbsolute = fromClassifier ? (v * t) / 100 : t;

    const e = eFactor?.multiplier ?? 1.0;
    const optimistic = v + f + i + dAbsolute + tAbsolute;
    const realistic  = optimistic * e;
    const calcResult = {
      v, f, i,
      d: dAbsolute,
      t: tAbsolute,
      eFactor: e,
      optimistic,
      realistic,
      difference: realistic - optimistic,
    };
    setResult(calcResult);
    localStorage.setItem("qantara_efactor", String(e));
  };

  // ── Finalize & navigate ─────────────────────────────────────────────────

  const handleFinalizeAndGenerateDocs = async () => {
    if (!result) return;
    setFinalizing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user && activeShipmentId) {
        const { error } = await supabase
          .from("shipments")
          .update({
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
            origin_city:         originCity || null,
            destination_city:    destinationCity || null,
            total_weight_kg:     parseFloat(totalWeightKg) || null,
            status:              "Calculated",
          } as any)
          .eq("id", activeShipmentId);
        if (error) throw error;
        toast({ title: "Costs finalized!", description: "Shipment updated to Calculated status." });
      } else if (user && !activeShipmentId) {
        const { data: newShipment, error } = await supabase
          .from("shipments")
          .insert({
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
            origin_city:         originCity || null,
            destination_city:    destinationCity || null,
            total_weight_kg:     parseFloat(totalWeightKg) || null,
            status:              "Calculated",
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        const params = new URLSearchParams({
          hs_code: hsCode, product_name: productName || paramProduct,
          product_value: String(result.v), freight: String(result.f), from: "lce",
        });
        if (newShipment?.id) params.set("shipment_id", newShipment.id);
        navigate(`/documentation-workshop?${params.toString()}`);
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
      setFinalizing(false);
      return;
    }

    const params = new URLSearchParams({
      hs_code: hsCode, product_name: productName || paramProduct,
      product_value: String(result.v), freight: String(result.f), from: "lce",
    });
    if (activeShipmentId) params.set("shipment_id", activeShipmentId);
    navigate(`/documentation-workshop?${params.toString()}`);
    setFinalizing(false);
  };

  const handleReset = () => {
    setProductValue(""); setFreight(""); setInsurance("");
    if (!fromClassifier) { setDuty(""); setTaxes(""); setHsCode(""); setProductName(""); }
    setEFactor(null); setResult(null);
    setLogisticsRates([]); setSelectedRoute(null); setStrategicAdvice(""); setRouteDiscoveryOpen(false);
    setOriginCity(""); setDestinationCity(""); setTotalWeightKg("");
  };

  const canFindRoutes = originCity.trim() !== "" && destinationCity.trim() !== "" && (parseFloat(totalWeightKg) || 0) > 0;

  const handleFetchRoutes = async () => {
    setRoutesLoading(true);
    try {
      // Persist specs to Supabase if we have an active shipment
      if (activeShipmentId) {
        const { error: updateErr } = await supabase
          .from("shipments")
          .update({ origin_city: originCity, destination_city: destinationCity, total_weight_kg: parseFloat(totalWeightKg) || 0 })
          .eq("id", activeShipmentId);
        if (updateErr) console.error("Failed to persist shipment specs:", updateErr);
      }

      const { data, error } = await supabase.functions.invoke("fetch-logistics-rates", {
        body: {
          origin_city: originCity,
          destination_city: destinationCity,
          weight_kg: parseFloat(totalWeightKg) || 100,
          e_factor: eFactor?.multiplier ?? 1.0,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLogisticsRates(data.routes || []);
      setStrategicAdvice(data.strategic_advice || "");
      setRouteDiscoveryOpen(true);
      toast({ title: "Routes loaded", description: `${data.routes?.length || 0} options for ${originCity} → ${destinationCity}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch routes";
      toast({ title: "Route Discovery Error", description: msg, variant: "destructive" });
    } finally {
      setRoutesLoading(false);
    }
  };

  const handleSelectRoute = (route: LogisticsRoute) => {
    setSelectedRoute(route);
    setFreight(String(route.calculated_price));
    toast({ title: "Route selected", description: `${route.provider} — $${route.calculated_price} freight applied` });
    if (result) handleCalculate();
  };

  const congestionInfo = eFactor ? PORT_CONGESTION[eFactor.portCongestion] : null;
  const stormInfo      = eFactor ? STORM_RISK[eFactor.stormRisk]           : null;

  return (
    <AppLayout title="Landed Cost Engine" subtitle="V + F + I + D + T × E-Factor">
      <div className="max-w-5xl mx-auto space-y-6">

        <WorkflowStepper currentStep={2} />

        {/* Recovered shipment banner */}
        {recovered && !fromClassifier && (
          <div className="rounded-xl border border-risk-low/30 bg-risk-low/6 px-4 py-3 flex items-center gap-3 animate-fade-in">
            <Database className="w-4 h-4 text-risk-low shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">
                Shipment auto-recovered: <span className="text-primary">{recoveredShipment?.product_name || "Unnamed"}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">Most recent Draft shipment loaded automatically.</p>
            </div>
            <Badge variant="outline" className="text-[10px] border-risk-low/40 text-risk-low gap-1 shrink-0">
              <Database className="w-2.5 h-2.5" /> Recovered
            </Badge>
          </div>
        )}

        {/* Provenance banner */}
        {fromClassifier && (
          <div className="rounded-xl border border-primary/20 bg-primary/6 px-4 py-3.5 flex items-center gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">Data transferred from HS Neural-Navigator</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                HS code <span className="font-mono font-bold text-foreground">{paramHsCode}</span>
                {" · "}Duty <strong className="text-foreground">{paramDuty}%</strong>
                {" · "}Tax <strong className="text-foreground">{paramTax}%</strong>
                {paramConfidence && <> · Match confidence <strong className="text-foreground">{paramConfidence}%</strong></>}
                {activeShipmentId && <> · <span className="text-risk-low font-medium">✓ Shipment ID linked</span></>}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary shrink-0">Auto-filled</Badge>
            <button onClick={() => navigate("/hs-navigator")} className="ml-2 shrink-0 text-[11px] text-primary hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          </div>
        )}

        {/* Cost Inputs */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Product Name</Label>
                <Input placeholder="e.g. Argan Oil — 250ml" value={productName} onChange={(e) => setProductName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">HS Code</Label>
                <Input placeholder="e.g. 1515.30" value={hsCode} onChange={(e) => setHsCode(e.target.value)}
                  readOnly={fromClassifier} className={cn(fromClassifier && "bg-muted/50 text-muted-foreground cursor-default")} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <CostField label="V — Product Value" placeholder="0.00" value={productValue} onChange={setProductValue} userInput />
              <CostField label="F — Freight Cost" placeholder="0.00" value={freight} onChange={setFreight} userInput />
              <CostField label="I — Insurance" placeholder="0.00" value={insurance} onChange={setInsurance} userInput />
              <CostField label="D — Duty Rate" placeholder="0.00" value={duty} onChange={setDuty} locked={fromClassifier}
                suffix={fromClassifier ? "% of V" : undefined} hint={fromClassifier ? "TARIC rate" : undefined} />
              <CostField label="T — Tax Rate" placeholder="0.00" value={taxes} onChange={setTaxes} locked={fromClassifier}
                suffix={fromClassifier ? "% of V" : undefined} hint={fromClassifier ? "TARIC rate" : undefined} />
            </div>

            <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-2.5 flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs text-primary font-semibold">Total = V + F + I + D + T</span>
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

        {/* Route Discovery */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Search className="w-3.5 h-3.5 text-primary" />
              </div>
              Route Discovery
              {selectedRoute && (
                <Badge variant="outline" className="ml-auto text-[10px] border-success/30 text-success gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {selectedRoute.provider}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Shipment Specifications */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Shipment Specifications</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Origin City</Label>
                  <Input placeholder="e.g. Fes, Casablanca" value={originCity} onChange={(e) => setOriginCity(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Destination City</Label>
                  <Input placeholder="e.g. Paris, New York" value={destinationCity} onChange={(e) => setDestinationCity(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Total Weight (kg)</Label>
                  <Input type="number" min="0" step="0.1" placeholder="e.g. 500" value={totalWeightKg} onChange={(e) => setTotalWeightKg(e.target.value)} />
                </div>
              </div>
            </div>

            <Button onClick={handleFetchRoutes} disabled={routesLoading || !canFindRoutes} variant="outline" className="border-primary/30 text-primary hover:bg-primary/5">
              {routesLoading ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scraping carriers for {originCity} to {destinationCity} for {totalWeightKg}kg package…</>
              ) : (
                <><Search className="w-3.5 h-3.5" /> Find Best Route</>
              )}
            </Button>

            {routeDiscoveryOpen && logisticsRates.length > 0 && (
              <div className="space-y-4 animate-fade-in">
                {/* Strategic Advice */}
                {strategicAdvice && (
                  <div className="rounded-lg border-2 border-primary/25 bg-primary/5 px-4 py-3 flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">Strategic Advice</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{strategicAdvice}</p>
                    </div>
                  </div>
                )}

                {/* Route cards grouped by mode */}
                {MODE_ORDER.filter(mode => logisticsRates.some(r => r.mode === mode)).map(mode => {
                  const ModeIcon = MODE_ICON[mode] || Ship;
                  const routes = logisticsRates.filter(r => r.mode === mode);
                  const isSeaRisk = mode === "Sea" && eFactor && eFactor.multiplier > 1.2;
                  const isRecommended = (mode === "Road" || mode === "Air") && eFactor && eFactor.multiplier > 1.2;
                  return (
                    <div key={mode}>
                      <div className="flex items-center gap-2 mb-2">
                        <ModeIcon className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{mode}</span>
                        {isSeaRisk && <Badge className="text-[9px] bg-risk-high/10 text-risk-high border-risk-high/30" variant="outline">⚠ Weather Warning</Badge>}
                        {isRecommended && <Badge className="text-[9px] bg-success/10 text-success border-success/30" variant="outline">✓ Qantara Recommended</Badge>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {routes.map((route, idx) => {
                          const isSelected = selectedRoute?.provider === route.provider && selectedRoute?.mode === route.mode;
                          return (
                            <button key={idx} onClick={() => handleSelectRoute(route)}
                              className={cn(
                                "text-left rounded-lg border p-3.5 transition-all hover:shadow-elevated",
                                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/30",
                                isSeaRisk && "opacity-75"
                              )}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-foreground">{route.provider}</span>
                                <span className="text-sm font-bold font-mono text-primary">${route.calculated_price.toLocaleString()}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mb-1">${route.cost_per_kg}/kg × {totalWeightKg || "—"}kg</p>
                              <div className="grid grid-cols-3 gap-2 text-[11px]">
                                <div>
                                  <p className="text-muted-foreground">ETA</p>
                                  <p className="font-semibold text-foreground">{route.transit_days}d</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Reliability</p>
                                  <div className="flex items-center gap-1">
                                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div className="h-full rounded-full bg-success" style={{ width: `${route.reliability_score}%` }} />
                                    </div>
                                    <span className="font-mono text-foreground">{route.reliability_score}%</span>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-muted-foreground flex items-center gap-0.5"><Leaf className="w-2.5 h-2.5" /> CO₂</p>
                                  <p className="font-mono text-foreground">{route.carbon_footprint}kg</p>
                                </div>
                              </div>
                              {isSelected && <p className="text-[10px] text-primary font-semibold mt-2">✓ Selected</p>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* E-Factor — Live Weather */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="w-7 h-7 rounded-lg bg-risk-high/10 border border-risk-high/20 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-risk-high" />
              </div>
              E-Factor — Risk Multiplier
              <Badge variant="outline" className="ml-auto text-xs border-border">
                OpenWeather Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Fetches <strong className="text-foreground">real-time weather data</strong> for Tanger Med, Casablanca & Agadir via OpenWeather API.
              Wind speed &gt; 25 knots adds +0.2 (port shutdown risk). Delay days add +0.05 each.
            </p>
            <Button
              onClick={handleFetchEFactor}
              disabled={eFactorLoading}
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/5"
            >
              {eFactorLoading ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Querying OpenWeather API…</>
              ) : (
                <><Ship className="w-3.5 h-3.5" /> Fetch Live E-Factor</>
              )}
            </Button>

            {/* Port weather cards */}
            {eFactor && eFactor.ports && eFactor.ports.length > 0 && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {eFactor.ports.map((p) => (
                    <div key={p.port} className="rounded-lg border border-border bg-card p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">{p.portName}</p>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-muted-foreground"><Wind className="w-3 h-3" /> Wind</span>
                          <span className={cn("font-mono font-bold", p.windSpeedKnots > 25 ? "text-risk-high" : p.windSpeedKnots > 18 ? "text-warning" : "text-risk-low")}>
                            {p.windSpeedKnots} kn
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-muted-foreground"><Eye className="w-3 h-3" /> Visibility</span>
                          <span className="font-mono text-foreground">{(p.visibility / 1000).toFixed(1)} km</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-muted-foreground"><Thermometer className="w-3 h-3" /> Temp</span>
                          <span className="font-mono text-foreground">{p.temperature.toFixed(1)}°C</span>
                        </div>
                        <p className="text-muted-foreground capitalize">{p.weatherDescription}</p>
                        {p.hasStormAlert && (
                          <Badge variant="outline" className="text-[9px] border-risk-high/30 text-risk-high bg-risk-high/10">⚠ Storm Alert</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={cn("rounded-lg border p-4 space-y-2 border-border", congestionInfo?.bg)}>
                    <div className="flex items-center gap-2">
                      <Anchor className={cn("w-4 h-4", congestionInfo?.color)} />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Port Congestion</span>
                    </div>
                    <p className={cn("text-lg font-bold", congestionInfo?.color)}>{congestionInfo?.label}</p>
                    <p className="text-xs text-muted-foreground">Est. delay: {eFactor.breakdown.totalDelayDays} days</p>
                  </div>
                  <div className={cn("rounded-lg border p-4 space-y-2 border-border", stormInfo?.bg)}>
                    <div className="flex items-center gap-2">
                      <CloudLightning className={cn("w-4 h-4", stormInfo?.color)} />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Storm Risk</span>
                    </div>
                    <p className={cn("text-lg font-bold", stormInfo?.color)}>{stormInfo?.label}</p>
                    <p className="text-xs text-muted-foreground">Wind contrib: +{(eFactor.breakdown.windContribution * 100).toFixed(1)}%</p>
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleCalculate} disabled={!productValue} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Calculator className="w-4 h-4" /> Calculate Landed Cost
          </Button>
          <Button onClick={handleReset} variant="ghost" className="text-muted-foreground hover:text-foreground ml-auto">
            <RefreshCw className="w-4 h-4" /> Reset
          </Button>
        </div>

        {/* Comparison Table */}
        {result && (
          <Card className="border-border shadow-card animate-fade-in">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                </div>
                Cost Breakdown — Optimistic vs Realistic
                {productName && (
                  <Badge variant="outline" className="ml-auto text-xs border-border font-normal">{productName}</Badge>
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
                      Based on live weather conditions at Moroccan export terminals.
                    </p>
                  </div>
                </div>
              )}

              {result.eFactor === 1.0 && (
                <div className="mt-4 rounded-lg border border-risk-low/25 bg-risk-low/8 px-4 py-3 flex items-center gap-3">
                  <Wind className="w-4 h-4 text-risk-low" />
                  <p className="text-xs text-muted-foreground">
                    No E-Factor premium. Run the live weather assessment above for a realistic cost projection.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Finalize CTA */}
        {result && (
          <div className="animate-fade-in rounded-xl border-2 border-primary bg-primary/8 p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Costs Calculated — Ready to Generate Documents</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Realistic cost: <span className="font-mono font-bold text-foreground">{fmt(result.realistic)}</span>
                  {result.eFactor > E_FACTOR_RISK_THRESHOLD && (
                    <span className="ml-2 text-warning font-semibold">⚠ High E-Factor risk</span>
                  )}
                  {activeShipmentId && <span className="ml-2 text-risk-low font-medium">· Shipment will be updated</span>}
                </p>
              </div>
            </div>
            <Button onClick={handleFinalizeAndGenerateDocs} disabled={finalizing}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold h-12 shadow-md" size="lg">
              {finalizing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Saving & Redirecting…</>
              ) : (
                <>Finalize Costs & Generate Documents <ArrowRight className="w-5 h-5" /></>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              This will save the calculated costs and open the Documentation Workshop with your data pre-filled
            </p>
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
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">{label}</Label>
        {locked && <Lock className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />}
        {userInput && (
          <span className="text-[9px] uppercase tracking-wide text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-sm">Input</span>
        )}
      </div>
      <div className="relative">
        {!suffix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>}
        <Input type="number" min="0" step="0.01" placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)} readOnly={locked}
          className={cn(!suffix && "pl-6", locked && "bg-muted/50 cursor-default border-dashed text-muted-foreground")} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{suffix}</span>}
      </div>
      {hint && <p className="text-[10px] text-primary/70 font-medium">{hint}</p>}
    </div>
  );
}
