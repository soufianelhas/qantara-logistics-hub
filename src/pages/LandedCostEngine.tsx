import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calculator, Wind, Anchor, AlertTriangle, TrendingUp, RefreshCw,
  CloudLightning, Ship, CheckCircle2, Lock, Brain, FileText,
  ArrowLeft, ArrowRight, Thermometer, Eye, Database, Truck,
  Plane, TrainFront, Leaf, Sparkles, Search, MapPin, Package,
  ChevronDown, Info, Plus, Building, Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useShipmentRecovery } from "@/hooks/use-shipment-recovery";
import { AddClientModal } from "@/components/AddClientModal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortWeather {
  port: string; portName: string; windSpeedKnots: number;
  visibility: number; hasStormAlert: boolean; weatherDescription: string; temperature: number;
}

interface EFactorData {
  portCongestion: "low" | "medium" | "high" | "critical";
  stormRisk: "none" | "low" | "moderate" | "severe";
  multiplier: number; ports: PortWeather[];
  breakdown: { base: number; windContribution: number; congestionContribution: number; totalDelayDays: number; };
}

interface CalculationResult {
  v: number; f: number; i: number; d: number; t: number;
  eFactor: number; agencyFee: number;
  optimistic: number; realistic: number; difference: number;
}

interface LogisticsRoute {
  mode: "Sea" | "Air" | "Road" | "Rail"; provider: string;
  base_cost: number; cost_per_kg: number; transit_days: number;
  reliability_score: number; carbon_footprint: number; currency: string; calculated_price: number;
}

interface ClientOption { id: string; name: string; }

const MODE_ICON: Record<string, typeof Ship> = { Sea: Ship, Air: Plane, Road: Truck, Rail: TrainFront };
const MODE_ORDER = ["Sea", "Air", "Road", "Rail"];

const INCOTERMS: { value: string; label: string; description: string }[] = [
  { value: "EXW", label: "EXW", description: "Ex Works: Buyer handles everything from seller's premises" },
  { value: "FOB", label: "FOB", description: "Free On Board: Seller delivers to port, buyer handles shipping" },
  { value: "CIF", label: "CIF", description: "Cost, Insurance & Freight: Seller pays freight+insurance to destination port" },
  { value: "DDP", label: "DDP", description: "Delivered Duty Paid: Agency handles everything, including import duties/taxes" },
];

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
  const calculatorRef = useRef<HTMLDivElement>(null);

  const fromClassifier = searchParams.get("from") === "classifier";
  const paramHsCode     = searchParams.get("hs_code") || "";
  const paramDuty       = parseFloat(searchParams.get("duty") || "0");
  const paramTax        = parseFloat(searchParams.get("tax") || "0");
  const paramProduct    = searchParams.get("product_name") || "";
  const paramConfidence = searchParams.get("confidence") || "";
  const paramShipmentId = searchParams.get("shipment_id") || null;

  const { shipmentId: recoveredId, shipment: recoveredShipment, loading: recoveryLoading, recovered, setShipmentId: setRecoveredId } = useShipmentRecovery(paramShipmentId, ["Draft", "Calculated"]);
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(paramShipmentId);

  useEffect(() => {
    if (recoveredId && !activeShipmentId) setActiveShipmentId(recoveredId);
  }, [recoveredId]);

  // User-editable fields
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

  // Shipment specs
  const [originCity, setOriginCity] = useState(() => localStorage.getItem("qantara_lce_originCity") || "");
  const [destinationCity, setDestinationCity] = useState(() => localStorage.getItem("qantara_lce_destinationCity") || "");
  const [totalWeightKg, setTotalWeightKg] = useState(() => localStorage.getItem("qantara_lce_totalWeightKg") || "");

  // Route Discovery
  const [routeDiscoveryOpen, setRouteDiscoveryOpen] = useState(false);
  const [logisticsRates, setLogisticsRates] = useState<LogisticsRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<LogisticsRoute | null>(null);
  const [strategicAdvice, setStrategicAdvice] = useState("");
  const calculatorUnlocked = selectedRoute !== null;

  // Agency fields
  const [clientId, setClientId] = useState<string | null>(() => {
    const stored = localStorage.getItem("qantara_lce_clientId");
    return stored && stored !== "null" ? stored : null;
  });
  const [incoterm, setIncoterm] = useState(() => localStorage.getItem("qantara_lce_incoterm") || "EXW");
  const [agencyFee, setAgencyFee] = useState(() => localStorage.getItem("qantara_lce_agencyFee") || "");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [showQuote, setShowQuote] = useState(false);

  // Persist new fields
  useEffect(() => { try { localStorage.setItem("qantara_lce_clientId", clientId || ""); } catch {} }, [clientId]);
  useEffect(() => { try { localStorage.setItem("qantara_lce_incoterm", incoterm); } catch {} }, [incoterm]);
  useEffect(() => { try { localStorage.setItem("qantara_lce_agencyFee", agencyFee); } catch {} }, [agencyFee]);

  // Persist existing fields
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

  // Fetch clients
  useEffect(() => {
    const fetchClients = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("clients").select("id, name").eq("user_id", user.id).order("name");
      if (data) setClients(data as ClientOption[]);
    };
    fetchClients();
  }, []);

  // Load recovered shipment data
  useEffect(() => {
    if (recovered && recoveredShipment && !fromClassifier) {
      if (recoveredShipment.product_name) setProductName(recoveredShipment.product_name);
      if (recoveredShipment.hs_code_assigned) setHsCode(recoveredShipment.hs_code_assigned);
      if (recoveredShipment.client_id) setClientId(recoveredShipment.client_id);
      if (recoveredShipment.incoterm) setIncoterm(recoveredShipment.incoterm);
      if (recoveredShipment.agency_fee) setAgencyFee(String(recoveredShipment.agency_fee));
      if (recoveredShipment.origin_city) setOriginCity(recoveredShipment.origin_city);
      if (recoveredShipment.destination_city) setDestinationCity(recoveredShipment.destination_city);
      if (recoveredShipment.total_weight_kg) setTotalWeightKg(String(recoveredShipment.total_weight_kg));
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

  // ── E-Factor ──────────────────────────────────────────────────────────────

  const handleFetchEFactor = async () => {
    setEFactorLoading(true); setEFactor(null);
    try {
      const { data, error } = await supabase.functions.invoke("weather-efactor");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEFactor(data as EFactorData);
      toast({ title: "E-Factor Assessed — Live Data", description: `Multiplier: ×${data.multiplier}` });
    } catch (err: unknown) {
      toast({ title: "E-Factor Error", description: err instanceof Error ? err.message : "Weather fetch failed", variant: "destructive" });
    } finally { setEFactorLoading(false); }
  };

  // ── Calculate ─────────────────────────────────────────────────────────────

  const handleCalculate = () => {
    const v = parseFloat(productValue) || 0;
    const f = parseFloat(freight)       || 0;
    const i = parseFloat(insurance)     || 0;
    const d = parseFloat(duty)          || 0;
    const t = parseFloat(taxes)         || 0;
    const af = parseFloat(agencyFee)    || 0;

    const dAbsolute = fromClassifier ? (v * d) / 100 : d;
    const tAbsolute = fromClassifier ? (v * t) / 100 : t;
    const e = eFactor?.multiplier ?? 1.0;

    const optimistic = v + f + i + dAbsolute + tAbsolute;
    const realistic  = (optimistic * e) + af;
    setResult({ v, f, i, d: dAbsolute, t: tAbsolute, eFactor: e, agencyFee: af, optimistic, realistic, difference: realistic - optimistic });
    localStorage.setItem("qantara_efactor", String(e));
  };

  // ── Finalize & navigate ─────────────────────────────────────────────────

  const handleFinalizeAndGenerateDocs = async () => {
    if (!result) return;
    setFinalizing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const shipmentPayload = {
        product_name: productName || paramProduct || "Unnamed Product",
        raw_cost_v: result.v, freight: result.f, insurance: result.i, duty: result.d, taxes: result.t,
        e_factor_multiplier: result.eFactor, hs_code_assigned: hsCode || null,
        port_congestion_level: eFactor?.portCongestion ?? null, weather_risk_level: eFactor?.stormRisk ?? null,
        origin_city: originCity || null, destination_city: destinationCity || null,
        total_weight_kg: parseFloat(totalWeightKg) || null, status: "Calculated" as const,
        client_id: clientId || null, agency_fee: result.agencyFee, incoterm,
      };

      if (user && activeShipmentId) {
        const { error } = await supabase.from("shipments").update(shipmentPayload as any).eq("id", activeShipmentId);
        if (error) throw error;
        toast({ title: "Costs finalized!", description: "Shipment updated." });
      } else if (user && !activeShipmentId) {
        const { data: newShipment, error } = await supabase.from("shipments")
          .insert({ ...shipmentPayload, user_id: user.id } as any).select("id").single();
        if (error) throw error;
        const params = new URLSearchParams({ hs_code: hsCode, product_name: productName || paramProduct, product_value: String(result.v), freight: String(result.f), from: "lce" });
        if (newShipment?.id) params.set("shipment_id", newShipment.id);
        navigate(`/documentation-workshop?${params.toString()}`);
        return;
      }
    } catch (err: unknown) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      setFinalizing(false);
      return;
    }

    const params = new URLSearchParams({ hs_code: hsCode, product_name: productName || paramProduct, product_value: String(result.v), freight: String(result.f), from: "lce" });
    if (activeShipmentId) params.set("shipment_id", activeShipmentId);
    navigate(`/documentation-workshop?${params.toString()}`);
    setFinalizing(false);
  };

  const handleReset = () => {
    setProductValue(""); setFreight(""); setInsurance(""); setAgencyFee("");
    if (!fromClassifier) { setDuty(""); setTaxes(""); setHsCode(""); setProductName(""); }
    setEFactor(null); setResult(null); setShowQuote(false);
    setLogisticsRates([]); setSelectedRoute(null); setStrategicAdvice(""); setRouteDiscoveryOpen(false);
    setOriginCity(""); setDestinationCity(""); setTotalWeightKg("");
    setClientId(null); setIncoterm("EXW");
  };

  const canFindRoutes = originCity.trim() !== "" && destinationCity.trim() !== "" && (parseFloat(totalWeightKg) || 0) > 0;

  const handleFetchRoutes = async () => {
    setRoutesLoading(true);
    try {
      if (activeShipmentId) {
        await supabase.from("shipments").update({ origin_city: originCity, destination_city: destinationCity, total_weight_kg: parseFloat(totalWeightKg) || 0 }).eq("id", activeShipmentId);
      }
      const { data, error } = await supabase.functions.invoke("fetch-logistics-rates", {
        body: { origin_city: originCity, destination_city: destinationCity, weight_kg: parseFloat(totalWeightKg) || 100, e_factor: eFactor?.multiplier ?? 1.0 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLogisticsRates(data.routes || []); setStrategicAdvice(data.strategic_advice || ""); setRouteDiscoveryOpen(true);
      toast({ title: "Routes loaded", description: `${data.routes?.length || 0} options` });
    } catch (err: unknown) {
      toast({ title: "Route Discovery Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally { setRoutesLoading(false); }
  };

  const handleSelectRoute = (route: LogisticsRoute) => {
    setSelectedRoute(route); setFreight(String(route.calculated_price));
    toast({ title: "Route selected", description: `${route.provider} — $${route.calculated_price} freight applied` });
    setTimeout(() => { calculatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 150);
    if (result) handleCalculate();
  };

  const congestionInfo = eFactor ? PORT_CONGESTION[eFactor.portCongestion] : null;
  const stormInfo      = eFactor ? STORM_RISK[eFactor.stormRisk]           : null;
  const selectedClientName = clients.find(c => c.id === clientId)?.name || null;

  return (
    <AppLayout title="Landed Cost Engine" subtitle="V + F + I + D + T × E-Factor + Agency Fee">
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

        {/* ═══════════════ STEP 0: Client & Incoterms ═══════════════ */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Building className="w-3.5 h-3.5 text-primary" />
              </div>
              <span>Client & Terms</span>
              {clientId && (
                <Badge variant="outline" className="ml-auto text-[10px] border-success/30 text-success gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {selectedClientName}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client</Label>
                <div className="flex gap-2">
                  <Select value={clientId || ""} onValueChange={(v) => setClientId(v || null)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="shrink-0 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => setAddClientOpen(true)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  Incoterm
                </Label>
                <Select value={incoterm} onValueChange={setIncoterm}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOTERMS.map(ic => (
                      <SelectItem key={ic.value} value={ic.value}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{ic.label}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[200px] text-xs">
                              {ic.description}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Receipt className="w-3 h-3" /> Agency / Consultancy Fee
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" value={agencyFee}
                    onChange={(e) => setAgencyFee(e.target.value)} className="pl-6" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════ STEP 1: Shipment Specifications ═══════════════ */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-primary" />
              </div>
              <span>Step 1 — Shipment Specifications</span>
              {canFindRoutes && (
                <Badge variant="outline" className="ml-auto text-[10px] border-success/30 text-success gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Complete
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Origin City
                </Label>
                <Input placeholder="e.g. Fes, Casablanca" value={originCity} onChange={(e) => setOriginCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Destination City
                </Label>
                <Input placeholder="e.g. Paris, New York" value={destinationCity} onChange={(e) => setDestinationCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Package className="w-3 h-3" /> Total Weight (kg)
                </Label>
                <Input type="number" min="0" step="0.1" placeholder="e.g. 500" value={totalWeightKg} onChange={(e) => setTotalWeightKg(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════ STEP 1b: E-Factor ═══════════════ */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="w-7 h-7 rounded-lg bg-risk-high/10 border border-risk-high/20 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-risk-high" />
              </div>
              E-Factor — Risk Multiplier
              <Badge variant="outline" className="ml-auto text-xs border-border">OpenWeather Live</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Fetches <strong className="text-foreground">real-time weather data</strong> for Tanger Med, Casablanca & Agadir.
            </p>
            <Button onClick={handleFetchEFactor} disabled={eFactorLoading} variant="outline" className="border-primary/30 text-primary hover:bg-primary/5">
              {eFactorLoading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Querying…</> : <><Ship className="w-3.5 h-3.5" /> Fetch Live E-Factor</>}
            </Button>

            {eFactor && eFactor.ports && eFactor.ports.length > 0 && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {eFactor.ports.map((p) => (
                    <div key={p.port} className="rounded-lg border border-border bg-card p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground">{p.portName}</p>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-muted-foreground"><Wind className="w-3 h-3" /> Wind</span>
                          <span className={cn("font-mono font-bold", p.windSpeedKnots > 25 ? "text-risk-high" : p.windSpeedKnots > 18 ? "text-warning" : "text-risk-low")}>{p.windSpeedKnots} kn</span>
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
                        {p.hasStormAlert && <Badge variant="outline" className="text-[9px] border-risk-high/30 text-risk-high bg-risk-high/10">⚠ Storm Alert</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={cn("rounded-lg border p-4 space-y-2 border-border", congestionInfo?.bg)}>
                    <div className="flex items-center gap-2"><Anchor className={cn("w-4 h-4", congestionInfo?.color)} /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Port Congestion</span></div>
                    <p className={cn("text-lg font-bold", congestionInfo?.color)}>{congestionInfo?.label}</p>
                    <p className="text-xs text-muted-foreground">Est. delay: {eFactor.breakdown.totalDelayDays} days</p>
                  </div>
                  <div className={cn("rounded-lg border p-4 space-y-2 border-border", stormInfo?.bg)}>
                    <div className="flex items-center gap-2"><CloudLightning className={cn("w-4 h-4", stormInfo?.color)} /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Storm Risk</span></div>
                    <p className={cn("text-lg font-bold", stormInfo?.color)}>{stormInfo?.label}</p>
                    <p className="text-xs text-muted-foreground">Wind contrib: +{(eFactor.breakdown.windContribution * 100).toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">E-Factor</span></div>
                    <p className="text-2xl font-bold text-primary font-mono">×{eFactor.multiplier.toFixed(4)}</p>
                    <p className="text-xs text-muted-foreground">Premium: +{((eFactor.multiplier - 1) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════ STEP 2: Route Discovery ═══════════════ */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Search className="w-3.5 h-3.5 text-primary" />
              </div>
              <span>Step 2 — Route Discovery</span>
              {selectedRoute && (
                <Badge variant="outline" className="ml-auto text-[10px] border-success/30 text-success gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {selectedRoute.provider}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleFetchRoutes} disabled={routesLoading || !canFindRoutes} variant="outline"
              className="w-full border-primary/30 text-primary hover:bg-primary/5 h-11">
              {routesLoading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Searching routes…</> : !canFindRoutes ? <><Lock className="w-3.5 h-3.5" /> Complete specs above</> : <><Search className="w-3.5 h-3.5" /> Find Best Route</>}
            </Button>

            {routeDiscoveryOpen && logisticsRates.length > 0 && (
              <div className="space-y-4 animate-fade-in">
                {strategicAdvice && (
                  <div className="rounded-lg border-2 border-primary/25 bg-primary/5 px-4 py-3 flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">Consultant's Recommendation</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{strategicAdvice}</p>
                    </div>
                  </div>
                )}
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
                        {isRecommended && <Badge className="text-[9px] bg-success/10 text-success border-success/30" variant="outline">✓ Recommended</Badge>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {routes.map((route, idx) => {
                          const isSelected = selectedRoute?.provider === route.provider && selectedRoute?.mode === route.mode;
                          return (
                            <button key={idx} onClick={() => handleSelectRoute(route)}
                              className={cn("text-left rounded-lg border p-3.5 transition-all hover:shadow-elevated",
                                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/30",
                                isSeaRisk && "opacity-75")}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-foreground">{route.provider}</span>
                                <span className="text-sm font-bold font-mono text-primary">${route.calculated_price.toLocaleString()}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mb-1">${route.cost_per_kg}/kg × {totalWeightKg || "—"}kg</p>
                              <div className="grid grid-cols-3 gap-2 text-[11px]">
                                <div><p className="text-muted-foreground">ETA</p><p className="font-semibold text-foreground">{route.transit_days}d</p></div>
                                <div><p className="text-muted-foreground">Reliability</p>
                                  <div className="flex items-center gap-1">
                                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-success" style={{ width: `${route.reliability_score}%` }} /></div>
                                    <span className="font-mono text-foreground">{route.reliability_score}%</span>
                                  </div>
                                </div>
                                <div><p className="text-muted-foreground flex items-center gap-0.5"><Leaf className="w-2.5 h-2.5" /> CO₂</p><p className="font-mono text-foreground">{route.carbon_footprint}kg</p></div>
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

        {/* ═══════════════ STEP 3: Cost Breakdown Calculator ═══════════════ */}
        <div ref={calculatorRef}>
          <Card className={cn("border-border shadow-card transition-all duration-300", !calculatorUnlocked && "opacity-60")}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Calculator className="w-3.5 h-3.5 text-primary" />
                </div>
                <span>Step 3 — Detailed Cost Breakdown</span>
                {!calculatorUnlocked && (
                  <Badge variant="outline" className="ml-auto text-[10px] border-border text-muted-foreground gap-1">
                    <Lock className="w-2.5 h-2.5" /> Select a route to unlock
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!calculatorUnlocked && (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                  <ChevronDown className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Select a transport route above to unlock the cost calculator</p>
                </div>
              )}
              {calculatorUnlocked && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <CostField label="V — Product Value" placeholder="0.00" value={productValue} onChange={setProductValue} userInput />
                    <CostField label="F — Freight Cost" placeholder="0.00" value={freight} onChange={setFreight}
                      hint={selectedRoute ? `Auto-filled: ${selectedRoute.provider}` : undefined} />
                    <CostField label="I — Insurance" placeholder="0.00" value={insurance} onChange={setInsurance} userInput />
                    <CostField label="D — Duty Rate" placeholder="0.00" value={duty} onChange={setDuty} locked={fromClassifier}
                      suffix={fromClassifier ? "% of V" : undefined} hint={fromClassifier ? "TARIC rate" : undefined} />
                    <CostField label="T — Tax Rate" placeholder="0.00" value={taxes} onChange={setTaxes} locked={fromClassifier}
                      suffix={fromClassifier ? "% of V" : undefined} hint={fromClassifier ? "TARIC rate" : undefined} />
                  </div>
                  <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-2.5 flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs text-primary font-semibold">Total = (V + F + I + D + T) × E</span>
                    <span className="text-muted-foreground text-xs">+</span>
                    <span className="font-mono text-xs text-foreground font-semibold">Agency Fee</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleCalculate} disabled={!productValue || !calculatorUnlocked} className="bg-primary text-primary-foreground hover:bg-primary/90">
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
                {productName && <Badge variant="outline" className="ml-auto text-xs border-border font-normal">{productName}</Badge>}
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
                      { label: "F — Freight", value: result.f },
                      { label: "I — Insurance", value: result.i },
                      { label: `D — Duty${fromClassifier ? ` (${paramDuty}%)` : ""}`, value: result.d },
                      { label: `T — Tax${fromClassifier ? ` (${paramTax}%)` : ""}`, value: result.t },
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
                    {result.agencyFee > 0 && (
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td className="py-2.5 px-3 text-foreground font-medium">Agency / Consultancy Fee</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground">{fmt(result.agencyFee)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground bg-primary/3">{fmt(result.agencyFee)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground bg-risk-high/3">{fmt(result.agencyFee)}</td>
                      </tr>
                    )}
                    <tr className="bg-muted/40 font-semibold">
                      <td className="py-3.5 px-3 text-foreground font-bold">TOTAL LANDED COST</td>
                      <td className="py-3.5 px-3" />
                      <td className="py-3.5 px-3 text-right font-mono text-primary text-base bg-primary/8">{fmt(result.optimistic + result.agencyFee)}</td>
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
                      Risk Premium: {fmt(result.difference)}{" "}
                      <span className="text-risk-high">(+{result.optimistic > 0 ? ((result.difference / result.optimistic) * 100).toFixed(1) : "0"}%)</span>
                    </p>
                  </div>
                </div>
              )}

              {result.eFactor === 1.0 && (
                <div className="mt-4 rounded-lg border border-risk-low/25 bg-risk-low/8 px-4 py-3 flex items-center gap-3">
                  <Wind className="w-4 h-4 text-risk-low" />
                  <p className="text-xs text-muted-foreground">No E-Factor premium. Run live weather assessment above for realistic projection.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Finalize & Quote CTAs */}
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
                  {selectedClientName && <span className="ml-2">· Client: <strong className="text-foreground">{selectedClientName}</strong></span>}
                  {result.agencyFee > 0 && <span className="ml-2">· Agency Fee: <strong className="text-foreground">{fmt(result.agencyFee)}</strong></span>}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleFinalizeAndGenerateDocs} disabled={finalizing}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold h-12 shadow-md" size="lg">
                {finalizing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : <>Finalize Costs & Generate Documents <ArrowRight className="w-5 h-5" /></>}
              </Button>
              <Button onClick={() => setShowQuote(true)} variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/5 text-sm font-semibold h-12" size="lg">
                <Receipt className="w-4 h-4" /> Generate Client Quote
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════ QUOTE PREVIEW ═══════════════ */}
        {showQuote && result && (
          <Card className="border-2 border-primary/30 shadow-elevated animate-fade-in" id="quote-preview">
            <CardContent className="p-8 space-y-6">
              {/* Quote Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Anchor className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold text-foreground tracking-tight">Qantara</h2>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Professional Export Proposal</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium text-foreground">{new Date().toLocaleDateString("en-GB")}</p>
                  {activeShipmentId && (
                    <>
                      <p className="text-xs text-muted-foreground mt-1">Ref</p>
                      <p className="text-xs font-mono text-foreground">{activeShipmentId.slice(0, 8)}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Client info */}
              {selectedClientName && (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Prepared For</p>
                  <p className="text-sm font-semibold text-foreground">{selectedClientName}</p>
                </div>
              )}

              {/* Shipment details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div><p className="text-muted-foreground mb-0.5">Product</p><p className="font-medium text-foreground">{productName || "—"}</p></div>
                <div><p className="text-muted-foreground mb-0.5">HS Code</p><p className="font-mono font-medium text-foreground">{hsCode || "—"}</p></div>
                <div><p className="text-muted-foreground mb-0.5">Route</p><p className="font-medium text-foreground">{originCity} → {destinationCity}</p></div>
                <div><p className="text-muted-foreground mb-0.5">Weight</p><p className="font-medium text-foreground">{totalWeightKg || "—"} kg</p></div>
                <div><p className="text-muted-foreground mb-0.5">Incoterm</p><p className="font-mono font-bold text-primary">{incoterm}</p></div>
                {selectedRoute && (
                  <>
                    <div><p className="text-muted-foreground mb-0.5">Carrier</p><p className="font-medium text-foreground">{selectedRoute.provider}</p></div>
                    <div><p className="text-muted-foreground mb-0.5">ETA</p><p className="font-medium text-foreground">{selectedRoute.transit_days} days</p></div>
                    <div><p className="text-muted-foreground mb-0.5">Mode</p><p className="font-medium text-foreground">{selectedRoute.mode}</p></div>
                  </>
                )}
              </div>

              {/* Cost breakdown */}
              <div className="border-t border-b border-border py-4 space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Cost Breakdown</p>
                {[
                  { label: "Product Value (V)", value: result.v },
                  { label: "Freight (F)", value: result.f },
                  { label: "Insurance (I)", value: result.i },
                  { label: "Duty (D)", value: result.d },
                  { label: "Tax (T)", value: result.t },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono text-foreground">{fmt(item.value)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs pt-2 border-t border-border/50">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono font-semibold text-foreground">{fmt(result.optimistic)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">E-Factor Risk Multiplier</span>
                  <span className="font-mono text-foreground">×{result.eFactor.toFixed(4)}</span>
                </div>
                {result.agencyFee > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Agency / Consultancy Fee</span>
                    <span className="font-mono text-foreground">{fmt(result.agencyFee)}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-foreground">Total Landed Cost (Realistic)</span>
                <span className="text-xl font-bold font-mono text-primary">{fmt(result.realistic)}</span>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                This quote is based on live market conditions and risk assessment at the time of generation. Valid for 72 hours.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <AddClientModal open={addClientOpen} onOpenChange={setAddClientOpen}
        onClientAdded={(c) => { setClients(prev => [...prev, c]); setClientId(c.id); }} />
    </AppLayout>
  );
}

// ── CostField sub-component ───────────────────────────────────────────────────

interface CostFieldProps {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
  locked?: boolean; userInput?: boolean; suffix?: string; hint?: string;
}

function CostField({ label, placeholder, value, onChange, locked, userInput, suffix, hint }: CostFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">{label}</Label>
        {locked && <Lock className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />}
        {userInput && <span className="text-[9px] uppercase tracking-wide text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-sm">Input</span>}
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
