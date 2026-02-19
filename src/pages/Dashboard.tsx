import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import {
  Package,
  Ship,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  MapPin,
  Zap,
  Brain,
  Calculator,
  FileText,
  ArrowRight,
  X,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Static demo data ────────────────────────────────────────────────────────

const demoShipments = [
  {
    id: "QNT-2024-0841",
    origin: "Casablanca",
    destination: "Rotterdam",
    commodity: "Phosphate Derivatives",
    status: "In Transit",
    statusColor: "text-warning bg-warning/10 border-warning/20",
    progress: 68,
    eta: "Feb 24, 2026",
    vessel: "Maroc Star V",
  },
  {
    id: "QNT-2024-0839",
    origin: "Tanger Med",
    destination: "Hamburg",
    commodity: "Argan Oil (Bulk)",
    status: "Customs Hold",
    statusColor: "text-risk-high bg-risk-high/10 border-risk-high/20",
    progress: 45,
    eta: "Feb 26, 2026",
    vessel: "Atlantic Breeze",
  },
  {
    id: "QNT-2024-0835",
    origin: "Agadir",
    destination: "Barcelona",
    commodity: "Fresh Tomatoes",
    status: "Departed",
    statusColor: "text-success bg-success/10 border-success/20",
    progress: 82,
    eta: "Feb 21, 2026",
    vessel: "MedExpress 7",
  },
  {
    id: "QNT-2024-0831",
    origin: "Casablanca",
    destination: "Antwerp",
    commodity: "Textile Goods",
    status: "Cleared",
    statusColor: "text-success bg-success/10 border-success/20",
    progress: 95,
    eta: "Feb 20, 2026",
    vessel: "Euro Carrier II",
  },
];

const riskAlerts = [
  {
    id: "E-001",
    level: "high",
    title: "HS Code Mismatch — QNT-2024-0839",
    description:
      "Argan oil classified under 1515.90 may face reclassification risk at DE customs. E-factor score: 8.4/10.",
    time: "2h ago",
    action: "Review Classification",
  },
  {
    id: "E-002",
    level: "medium",
    title: "Landed Cost Deviation — QNT-2024-0841",
    description:
      "NL import duties recalculated due to EUR/MAD rate shift (+2.3%). Landed cost increased by €1,240.",
    time: "5h ago",
    action: "Recalculate",
  },
  {
    id: "E-003",
    level: "low",
    title: "Certificate of Origin Expiring — QNT-2024-0835",
    description:
      "EUR.1 movement certificate expires in 4 days. Renewal recommended before vessel arrival.",
    time: "1d ago",
    action: "Renew Document",
  },
];

const demoStats = [
  { label: "Active Shipments", value: "24", icon: Ship, delta: "+3 this week" },
  { label: "Customs Cleared", value: "18", icon: CheckCircle2, delta: "This month" },
  { label: "Avg Transit Days", value: "6.2", icon: Clock, delta: "-0.4 vs last mo." },
  { label: "Total Export Value", value: "€2.4M", icon: TrendingUp, delta: "+12% YTD" },
];

const riskColor = {
  high: "border-l-risk-high text-risk-high",
  medium: "border-l-warning text-warning",
  low: "border-l-success text-success",
};
const riskBg = {
  high: "bg-risk-high/8",
  medium: "bg-warning/8",
  low: "bg-success/8",
};
const riskIcon = {
  high: XCircle,
  medium: AlertTriangle,
  low: CheckCircle2,
};

// ── Shipment status → next workflow step mapping ─────────────────────────────

type ShipmentStatus = "Draft" | "Calculated" | "Filed" | "Port-Transit" | "Delivered";

function getNextStep(status: ShipmentStatus): { label: string; route: string; icon: React.ElementType } | null {
  switch (status) {
    case "Draft":
      return { label: "Move to Calculation", route: "/landed-cost", icon: Calculator };
    case "Calculated":
      return { label: "Generate Documents", route: "/documentation-workshop", icon: FileText };
    default:
      return null;
  }
}

function getStatusBadge(status: ShipmentStatus) {
  const map: Record<ShipmentStatus, string> = {
    Draft:        "text-muted-foreground bg-muted border-border",
    Calculated:   "text-warning bg-warning/10 border-warning/20",
    Filed:        "text-success bg-success/10 border-success/20",
    "Port-Transit": "text-primary bg-primary/10 border-primary/20",
    Delivered:    "text-success bg-success/10 border-success/20",
  };
  return map[status] ?? "text-muted-foreground bg-muted border-border";
}

// ── E_CRITICAL threshold ─────────────────────────────────────────────────────

const E_CRITICAL = 1.2;

// ── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();

  // Live shipments from Supabase
  const [liveShipments, setLiveShipments] = useState<Array<{
    id: string;
    product_name: string;
    hs_code_assigned: string | null;
    status: ShipmentStatus;
    e_factor_multiplier: number;
    raw_cost_v: number;
    freight: number;
    insurance: number;
    duty: number;
    taxes: number;
    created_at: string;
  }>>([]);
  const [loadingShipments, setLoadingShipments] = useState(false);

  // E-Factor global alert
  const [eFactorValue, setEFactorValue] = useState<number | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Strategic KPIs computed from live shipments
  const [kpis, setKpis] = useState({ avgEFactor: 0, totalSavings: 0, calculatedCount: 0 });

  useEffect(() => {
    // Read E-Factor from localStorage (written by LCE)
    const stored = localStorage.getItem("qantara_efactor");
    if (stored) {
      const val = parseFloat(stored);
      if (!isNaN(val)) setEFactorValue(val);
    }

    // Fetch shipments from Supabase
    const fetchShipments = async () => {
      setLoadingShipments(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("shipments")
          .select("id, product_name, hs_code_assigned, status, e_factor_multiplier, raw_cost_v, freight, insurance, duty, taxes, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (data) {
          setLiveShipments(data as typeof liveShipments);

          // Compute KPIs
          const calculated = data.filter((s) => s.status === "Calculated" || s.status === "Filed");
          const avgE = calculated.length > 0
            ? calculated.reduce((sum, s) => sum + s.e_factor_multiplier, 0) / calculated.length
            : 0;

          const totalSavings = calculated.reduce((sum, s) => {
            const base = s.raw_cost_v + s.freight + s.insurance + s.duty + s.taxes;
            const realistic = base * s.e_factor_multiplier;
            return sum + Math.max(0, realistic - base);
          }, 0);

          setKpis({ avgEFactor: avgE, totalSavings, calculatedCount: calculated.length });
        }
      } catch (e) {
        console.warn("Dashboard fetch failed (guest mode):", e);
      } finally {
        setLoadingShipments(false);
      }
    };

    fetchShipments();
  }, []);

  const isCriticalRisk = eFactorValue !== null && eFactorValue > E_CRITICAL && !alertDismissed;
  const recentInProgress = liveShipments.filter((s) => s.status === "Draft" || s.status === "Calculated").slice(0, 3);

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <AppLayout title="Dashboard" subtitle="Strategic Command Center · Feb 19, 2026">
      <div className="space-y-6">

        {/* ── Global E-Factor Risk Alert ─────────────────────────────── */}
        {isCriticalRisk && (
          <div className="rounded-xl border-2 border-warning/50 bg-warning/10 px-5 py-4 flex items-start gap-4 animate-fade-in">
            <div className="w-9 h-9 rounded-full bg-warning/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">
                ⚠ Logistics Risk Critical — E-Factor ×{eFactorValue?.toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                High winds / port congestion at <strong className="text-foreground">Tanger Med / Casablanca</strong>.
                Products flagged in Authenticity Studio. Consider pausing marketing promotions until conditions normalise.
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 border-warning/40 text-warning hover:bg-warning/10"
                  onClick={() => navigate("/authenticity-studio")}
                >
                  View Authenticity Studio <ArrowRight className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 border-warning/40 text-warning hover:bg-warning/10"
                  onClick={() => navigate("/landed-cost")}
                >
                  Recalculate Cost
                </Button>
              </div>
            </div>
            <button
              onClick={() => setAlertDismissed(true)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Static KPI cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {demoStats.map((stat, i) => (
            <div
              key={stat.label}
              className="bg-card rounded-lg border border-border p-4 shadow-card hover:shadow-elevated transition-shadow"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-md bg-primary/8 flex items-center justify-center">
                  <stat.icon className="w-4 h-4 text-primary" />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">{stat.label}</p>
              <p className="text-[11px] text-slate-accent mt-1">{stat.delta}</p>
            </div>
          ))}
        </div>

        {/* ── Strategic KPIs (live from Supabase) ───────────────────── */}
        {kpis.calculatedCount > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
            <div className="bg-card rounded-lg border border-border p-4 shadow-card flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Avg E-Factor Risk
                </p>
                <p className={cn(
                  "text-2xl font-bold font-mono mt-0.5",
                  kpis.avgEFactor > E_CRITICAL ? "text-risk-high" : kpis.avgEFactor > 1.1 ? "text-warning" : "text-success"
                )}>
                  ×{kpis.avgEFactor.toFixed(4)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Across {kpis.calculatedCount} calculated shipment{kpis.calculatedCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-4 shadow-card flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
                <TrendingDown className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Total Export Risk Premium
                </p>
                <p className="text-2xl font-bold font-mono mt-0.5 text-foreground">
                  {fmtCurrency(kpis.totalSavings)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Optimistic vs. realistic differential
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Active Workflow Card — Resume Recent ───────────────────── */}
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
              {loadingShipments && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
            </div>
            <div className="divide-y divide-border">
              {recentInProgress.map((s) => {
                const next = getNextStep(s.status);
                return (
                  <div key={s.id} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono font-medium text-primary truncate max-w-[180px]">
                          {s.id.slice(0, 8)}…
                        </span>
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", getStatusBadge(s.status))}>
                          {s.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{s.product_name}</p>
                      {s.hs_code_assigned && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          HS <span className="font-mono font-semibold text-foreground">{s.hs_code_assigned}</span>
                        </p>
                      )}
                    </div>
                    {next && (
                      <Button
                        size="sm"
                        className="shrink-0 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 h-8"
                        onClick={() => {
                          const params = new URLSearchParams({ shipment_id: s.id });
                          if (s.hs_code_assigned) params.set("hs_code", s.hs_code_assigned);
                          params.set("product_name", s.product_name);
                          navigate(`${next.route}?${params.toString()}`);
                        }}
                      >
                        <next.icon className="w-3.5 h-3.5" />
                        {next.label}
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Main content: Shipments + Risk Alerts ─────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* Active Shipments */}
          <div className="xl:col-span-3 bg-card rounded-lg border border-border shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Active Shipments</h2>
                <span className="text-xs bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-full font-medium">
                  {demoShipments.length}
                </span>
              </div>
              <button
                className="text-xs text-slate-accent hover:text-primary transition-colors font-medium"
                onClick={() => navigate("/hs-navigator")}
              >
                New Shipment →
              </button>
            </div>
            <div className="divide-y divide-border">
              {demoShipments.map((s) => (
                <div key={s.id} className="px-5 py-4 hover:bg-muted/30 transition-colors group cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-medium text-primary">{s.id}</span>
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", s.statusColor)}>
                          {s.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{s.commodity}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{s.origin}</span>
                        <span className="text-border">→</span>
                        <span>{s.destination}</span>
                        <span className="text-border">·</span>
                        <span>{s.vessel}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">ETA</p>
                      <p className="text-xs font-medium text-foreground">{s.eta}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Transit progress</span>
                      <span>{s.progress}%</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${s.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Logistics Risk Alert */}
          <div className="xl:col-span-2 bg-card rounded-lg border border-border shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-risk-high" />
                <h2 className="text-sm font-semibold text-foreground">Logistics Risk Alerts</h2>
              </div>
              <span className="text-[10px] bg-risk-high/10 text-risk-high border border-risk-high/20 px-2 py-0.5 rounded-full font-medium">
                E-Factor
              </span>
            </div>

            <div className="p-3 space-y-3">
              {riskAlerts.map((alert) => {
                const Icon = riskIcon[alert.level as keyof typeof riskIcon];
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "rounded-md border-l-2 px-3 py-3 cursor-pointer hover:brightness-95 transition-all",
                      riskColor[alert.level as keyof typeof riskColor],
                      riskBg[alert.level as keyof typeof riskBg],
                      "border border-border"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", riskColor[alert.level as keyof typeof riskColor])} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground leading-tight">{alert.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{alert.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground">{alert.time}</span>
                          <button className={cn("text-[10px] font-semibold hover:underline", riskColor[alert.level as keyof typeof riskColor])}>
                            {alert.action} →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Risk summary bar */}
            <div className="mx-3 mb-3 px-3 py-2.5 bg-muted/50 rounded-md border border-border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                Risk Distribution
              </p>
              <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
                <div className="bg-risk-high rounded-full" style={{ width: "25%" }} />
                <div className="bg-warning rounded-full" style={{ width: "25%" }} />
                <div className="bg-success rounded-full" style={{ width: "50%" }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                <span className="text-risk-high">1 High</span>
                <span className="text-warning">1 Medium</span>
                <span className="text-success">1 Low</span>
              </div>
            </div>

            {/* Workflow Quick-Start */}
            <div className="mx-3 mb-3 px-3 py-3 rounded-md border border-primary/20 bg-primary/5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2.5 font-medium">
                Start New Workflow
              </p>
              <div className="space-y-1.5">
                {[
                  { label: "Classify Product", route: "/hs-navigator", icon: Brain, step: "Step 1" },
                  { label: "Calculate Landed Cost", route: "/landed-cost", icon: Calculator, step: "Step 2" },
                  { label: "Generate Documents", route: "/documentation-workshop", icon: FileText, step: "Step 3" },
                ].map((item) => (
                  <button
                    key={item.route}
                    onClick={() => navigate(item.route)}
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-primary/8 transition-colors group"
                  >
                    <item.icon className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-[11px] font-medium text-foreground group-hover:text-primary transition-colors flex-1">
                      {item.label}
                    </span>
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
