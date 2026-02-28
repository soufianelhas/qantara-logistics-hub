import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import {
  Ship, AlertTriangle, TrendingUp, Clock, CheckCircle2, ArrowRight,
  Zap, Brain, Calculator, FileText, X, TrendingDown, RefreshCw,
  Package, Trash2, Users, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Compass as CompassIcon } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ShipmentStatus = "Draft" | "Calculated" | "Filed" | "Port-Transit" | "Delivered";

interface LiveShipment {
  id: string; product_name: string; hs_code_assigned: string | null;
  status: ShipmentStatus; e_factor_multiplier: number;
  raw_cost_v: number; freight: number; insurance: number; duty: number; taxes: number;
  created_at: string; port_congestion_level: string | null; weather_risk_level: string | null;
  client_id: string | null; agency_fee: number; incoterm: string;
  client_name?: string;
}

const E_CRITICAL = 1.2;

function getNextStep(status: ShipmentStatus): { label: string; route: string; icon: React.ElementType } | null {
  switch (status) {
    case "Draft": return { label: "Calculate Costs", route: "/landed-cost", icon: Calculator };
    case "Calculated": return { label: "Generate Documents", route: "/documentation-workshop", icon: FileText };
    case "Filed": return { label: "View Documents", route: "/documentation-workshop", icon: FileText };
    default: return null;
  }
}

function getStatusBadge(status: ShipmentStatus) {
  const map: Record<ShipmentStatus, string> = {
    Draft: "text-muted-foreground bg-muted border-border",
    Calculated: "text-warning bg-warning/10 border-warning/20",
    Filed: "text-success bg-success/10 border-success/20",
    "Port-Transit": "text-primary bg-primary/10 border-primary/20",
    Delivered: "text-success bg-success/10 border-success/20",
  };
  return map[status] ?? "text-muted-foreground bg-muted border-border";
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [shipments, setShipments] = useState<LiveShipment[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [eFactorValue, setEFactorValue] = useState<number | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const [kpis, setKpis] = useState({
    avgEFactor: 0, totalSavings: 0, calculatedCount: 0, totalShipments: 0,
    filedCount: 0, avgTransitDays: 0, projectedRevenue: 0, clientCount: 0,
  });

  useEffect(() => {
    const stored = localStorage.getItem("qantara_efactor");
    if (stored) { const val = parseFloat(stored); if (!isNaN(val)) setEFactorValue(val); }

    const fetchShipments = async () => {
      setLoadingShipments(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoadingShipments(false); return; }

        const { data } = await supabase
          .from("shipments")
          .select("id, product_name, hs_code_assigned, status, e_factor_multiplier, raw_cost_v, freight, insurance, duty, taxes, created_at, port_congestion_level, weather_risk_level, client_id, agency_fee, incoterm")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        // Get client names
        const { data: clientsData } = await supabase
          .from("clients")
          .select("id, name")
          .eq("user_id", user.id);

        const clientMap: Record<string, string> = {};
        clientsData?.forEach((c: any) => { clientMap[c.id] = c.name; });

        // Get unique client count
        const clientCount = clientsData?.length || 0;

        if (data) {
          const enriched = data.map((s: any) => ({
            ...s,
            client_name: s.client_id ? clientMap[s.client_id] || null : null,
          }));
          setShipments(enriched as LiveShipment[]);

          const calculated = data.filter((s: any) => s.status === "Calculated" || s.status === "Filed");
          const avgE = calculated.length > 0
            ? calculated.reduce((sum: number, s: any) => sum + s.e_factor_multiplier, 0) / calculated.length : 0;
          const totalSavings = calculated.reduce((sum: number, s: any) => {
            const base = s.raw_cost_v + s.freight + s.insurance + s.duty + s.taxes;
            return sum + Math.max(0, base * s.e_factor_multiplier - base);
          }, 0);
          const filed = data.filter((s: any) => ["Filed", "Port-Transit", "Delivered"].includes(s.status)).length;

          // Projected revenue: sum of agency_fee from active (non-Delivered) shipments
          const projectedRevenue = data
            .filter((s: any) => s.status !== "Delivered")
            .reduce((sum: number, s: any) => sum + (s.agency_fee || 0), 0);

          setKpis({
            avgEFactor: avgE, totalSavings, calculatedCount: calculated.length,
            totalShipments: data.length, filedCount: filed, avgTransitDays: 6.2,
            projectedRevenue, clientCount,
          });
        }
      } catch (e) {
        console.warn("Dashboard fetch failed:", e);
      } finally {
        setLoadingShipments(false);
      }
    };

    fetchShipments();
  }, []);

  const handleDeleteShipment = async (shipmentId: string) => {
    setDeletingId(shipmentId);
    try {
      const { error } = await supabase.from("shipments").delete().eq("id", shipmentId);
      if (error) throw error;
      setShipments(prev => prev.filter(s => s.id !== shipmentId));
      toast({ title: "Shipment deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const isCriticalRisk = eFactorValue !== null && eFactorValue > E_CRITICAL && !alertDismissed;
  const recentInProgress = shipments.filter((s) => s.status === "Draft" || s.status === "Calculated").slice(0, 3);

  const riskAlerts = shipments
    .filter(s => s.e_factor_multiplier > 1.1)
    .slice(0, 3)
    .map(s => ({
      id: s.id,
      level: s.e_factor_multiplier > 1.2 ? "high" : s.e_factor_multiplier > 1.15 ? "medium" : "low" as "high" | "medium" | "low",
      title: `E-Factor ×${s.e_factor_multiplier.toFixed(4)} — ${s.product_name}`,
      description: `HS ${s.hs_code_assigned || "pending"} · ${s.port_congestion_level ? `Port congestion: ${s.port_congestion_level}` : ""}${s.weather_risk_level ? ` · Storm: ${s.weather_risk_level}` : ""}`,
      time: new Date(s.created_at).toLocaleDateString("en-GB"),
    }));

  const riskColor = { high: "border-l-risk-high text-risk-high", medium: "border-l-warning text-warning", low: "border-l-success text-success" };
  const riskBg = { high: "bg-risk-high/8", medium: "bg-warning/8", low: "bg-success/8" };

  return (
    <AppLayout title="Dashboard" subtitle="Strategic Command Center">
      <div className="space-y-6">

        {/* Global E-Factor Risk Alert */}
        {isCriticalRisk && (
          <div className="rounded-xl border-2 border-warning/50 bg-warning/10 px-5 py-4 flex items-start gap-4 animate-fade-in">
            <div className="w-9 h-9 rounded-full bg-warning/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">⚠ Logistics Risk Critical — E-Factor ×{eFactorValue?.toFixed(4)}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                High winds / port congestion at <strong className="text-foreground">Tanger Med / Casablanca</strong>.
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Button size="sm" variant="outline" className="text-xs h-7 border-warning/40 text-warning hover:bg-warning/10" onClick={() => navigate("/landed-cost")}>
                  Recalculate Cost
                </Button>
              </div>
            </div>
            <button onClick={() => setAlertDismissed(true)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Live KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { label: "Total Shipments", value: String(kpis.totalShipments), icon: Ship, delta: `${kpis.filedCount} filed` },
            { label: "Customs Filed", value: String(kpis.filedCount), icon: CheckCircle2, delta: "This period" },
            { label: "Avg Transit Days", value: kpis.avgTransitDays.toFixed(1), icon: Clock, delta: "Estimated" },
            { label: "Calculated Value", value: fmtCurrency(kpis.totalSavings > 0 ? kpis.totalSavings * 10 : 0), icon: TrendingUp, delta: "Risk-adjusted" },
            { label: "Projected Revenue", value: fmtCurrency(kpis.projectedRevenue), icon: DollarSign, delta: "Agency fees" },
            { label: "Client Portfolio", value: String(kpis.clientCount), icon: Users, delta: "Active clients" },
          ].map((stat, i) => (
            <div key={stat.label} className="bg-card rounded-lg border border-border p-4 shadow-card hover:shadow-elevated transition-shadow"
              style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-md bg-primary/8 flex items-center justify-center">
                  <stat.icon className="w-4 h-4 text-primary" />
                </div>
                {loadingShipments && <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />}
              </div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">{loadingShipments ? "—" : stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">{stat.label}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{stat.delta}</p>
            </div>
          ))}
        </div>

        {/* Strategic KPIs */}
        {kpis.calculatedCount > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
            <div className="bg-card rounded-lg border border-border p-4 shadow-card flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Avg E-Factor Risk</p>
                <p className={cn("text-2xl font-bold font-mono mt-0.5",
                  kpis.avgEFactor > E_CRITICAL ? "text-risk-high" : kpis.avgEFactor > 1.1 ? "text-warning" : "text-success")}>
                  ×{kpis.avgEFactor.toFixed(4)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Across {kpis.calculatedCount} calculated shipments</p>
              </div>
            </div>
            <div className="bg-card rounded-lg border border-border p-4 shadow-card flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
                <TrendingDown className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Export Risk Premium</p>
                <p className="text-2xl font-bold font-mono mt-0.5 text-foreground">{fmtCurrency(kpis.totalSavings)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Optimistic vs. realistic differential</p>
              </div>
            </div>
          </div>
        )}

        {/* Resume Recent */}
        {recentInProgress.length > 0 && (
          <div className="bg-card rounded-lg border border-border shadow-card animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Resume Recent</h2>
                <span className="text-xs bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-full font-medium">
                  {recentInProgress.length} in progress
                </span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {recentInProgress.map((s) => {
                const next = getNextStep(s.status);
                return (
                  <div key={s.id} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono font-medium text-primary truncate max-w-[180px]">{s.id.slice(0, 8)}…</span>
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", getStatusBadge(s.status))}>{s.status}</span>
                        {s.client_name && <span className="text-[10px] text-muted-foreground">· {s.client_name}</span>}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{s.product_name}</p>
                      {s.hs_code_assigned && (
                        <p className="text-xs text-muted-foreground mt-0.5">HS <span className="font-mono font-semibold text-foreground">{s.hs_code_assigned}</span></p>
                      )}
                    </div>
                    {next && (
                      <Button size="sm" className="shrink-0 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 h-8"
                        onClick={() => {
                          const params = new URLSearchParams({ shipment_id: s.id });
                          if (s.hs_code_assigned) params.set("hs_code", s.hs_code_assigned);
                          params.set("product_name", s.product_name);
                          navigate(`${next.route}?${params.toString()}`);
                        }}>
                        <next.icon className="w-3.5 h-3.5" /> {next.label} <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main content: All Shipments + Risk Alerts */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* All Shipments */}
          <div className="xl:col-span-3 bg-card rounded-lg border border-border shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Recent Shipments</h2>
                <span className="text-xs bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-full font-medium">{shipments.length}</span>
              </div>
              <div className="flex items-center gap-3">
                {shipments.length > 5 && (
                  <button className="text-xs text-primary hover:text-primary/80 transition-colors font-medium" onClick={() => navigate("/shipments")}>View All →</button>
                )}
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium" onClick={() => navigate("/hs-navigator")}>New Shipment →</button>
              </div>
            </div>
            <div className="divide-y divide-border">
              {shipments.length === 0 && !loadingShipments && (
                <div className="px-5 py-8 text-center">
                  <Ship className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">No shipments yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Start by classifying a product in the HS Navigator</p>
                  <Button size="sm" className="mt-3" onClick={() => navigate("/hs-navigator")}><Brain className="w-3.5 h-3.5" /> Start Classification</Button>
                </div>
              )}
              {loadingShipments && (
                <div className="px-5 py-8 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 text-primary animate-spin" /><span className="text-xs text-muted-foreground">Loading shipments…</span>
                </div>
              )}
              {shipments.slice(0, 5).map((s) => {
                const totalCost = s.raw_cost_v + s.freight + s.insurance + s.duty + s.taxes;
                return (
                  <div key={s.id} className="px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer flex items-center gap-4" onClick={() => navigate(`/shipments/${s.id}`)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-medium text-primary">{s.id.slice(0, 8)}…</span>
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", getStatusBadge(s.status))}>{s.status}</span>
                        {s.e_factor_multiplier > 1.1 && (
                          <Badge variant="outline" className="text-[9px] border-warning/30 text-warning">E×{s.e_factor_multiplier.toFixed(2)}</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{s.product_name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {s.hs_code_assigned && <span>HS <strong className="text-foreground">{s.hs_code_assigned}</strong></span>}
                        {totalCost > 0 && <span>{fmtCurrency(totalCost * s.e_factor_multiplier)}</span>}
                        {s.client_name && <span className="text-primary/70">· {s.client_name}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-xs font-medium text-foreground">{new Date(s.created_at).toLocaleDateString("en-GB")}</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive shrink-0" onClick={e => e.stopPropagation()}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={e => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete shipment?</AlertDialogTitle>
                          <AlertDialogDescription>Permanently delete "{s.product_name}"? This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDeleteShipment(s.id); }} disabled={deletingId === s.id} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {deletingId === s.id ? "Deleting…" : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk Alerts + Workflow */}
          <div className="xl:col-span-2 bg-card rounded-lg border border-border shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-risk-high" />
                <h2 className="text-sm font-semibold text-foreground">Logistics Risk Alerts</h2>
              </div>
              <span className="text-[10px] bg-risk-high/10 text-risk-high border border-risk-high/20 px-2 py-0.5 rounded-full font-medium">E-Factor</span>
            </div>

            <div className="p-3 space-y-3">
              {riskAlerts.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-2" />
                  No risk alerts — all shipments within normal parameters
                </div>
              )}
              {riskAlerts.map((alert) => (
                <div key={alert.id} className={cn("rounded-md border-l-2 px-3 py-3 transition-all",
                  riskColor[alert.level], riskBg[alert.level], "border border-border")}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", riskColor[alert.level])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-tight">{alert.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{alert.description}</p>
                      <span className="text-[10px] text-muted-foreground">{alert.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Workflow Quick-Start */}
            <div className="mx-3 mb-3 px-3 py-3 rounded-md border border-primary/20 bg-primary/5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2.5 font-medium">Start New Workflow</p>
              <div className="space-y-1.5">
                {[
                  { label: "Classify Product", route: "/hs-navigator", icon: Brain, step: "Step 1" },
                  { label: "Calculate Landed Cost", route: "/landed-cost", icon: Calculator, step: "Step 2" },
                  { label: "Generate Documents", route: "/documentation-workshop", icon: FileText, step: "Step 3" },
                ].map((item) => (
                  <button key={item.route} onClick={() => navigate(item.route)}
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-primary/8 transition-colors group">
                    <item.icon className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-[11px] font-medium text-foreground group-hover:text-primary transition-colors flex-1">{item.label}</span>
                    <span className="text-[9px] text-muted-foreground">{item.step}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
