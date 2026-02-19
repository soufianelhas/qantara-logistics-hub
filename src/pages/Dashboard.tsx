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
} from "lucide-react";
import { cn } from "@/lib/utils";

const shipments = [
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

const stats = [
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

export default function Dashboard() {
  return (
    <AppLayout
      title="Dashboard"
      subtitle="Overview · Feb 19, 2026"
    >
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
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
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                {stat.label}
              </p>
              <p className="text-[11px] text-slate-accent mt-1">{stat.delta}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Active Shipments */}
          <div className="xl:col-span-3 bg-card rounded-lg border border-border shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Active Shipments
                </h2>
                <span className="text-xs bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-full font-medium">
                  {shipments.length}
                </span>
              </div>
              <button className="text-xs text-slate-accent hover:text-primary transition-colors font-medium">
                View all →
              </button>
            </div>
            <div className="divide-y divide-border">
              {shipments.map((s) => (
                <div
                  key={s.id}
                  className="px-5 py-4 hover:bg-muted/30 transition-colors group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-medium text-primary">
                          {s.id}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                            s.statusColor
                          )}
                        >
                          {s.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.commodity}
                      </p>
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
                  {/* Progress bar */}
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
                <h2 className="text-sm font-semibold text-foreground">
                  Logistics Risk Alerts
                </h2>
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
                        <p className="text-xs font-semibold text-foreground leading-tight">
                          {alert.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          {alert.description}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground">
                            {alert.time}
                          </span>
                          <button
                            className={cn(
                              "text-[10px] font-semibold hover:underline",
                              riskColor[alert.level as keyof typeof riskColor]
                            )}
                          >
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
