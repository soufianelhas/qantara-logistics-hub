import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search, Package, RefreshCw, Trash2, ArrowUpDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type ShipmentStatus = "Draft" | "Calculated" | "Filed" | "Port-Transit" | "Delivered";

interface Shipment {
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
  total_weight_kg: number | null;
  created_at: string;
}

const STATUS_BADGE: Record<ShipmentStatus, string> = {
  Draft: "text-muted-foreground bg-muted border-border",
  Calculated: "text-warning bg-warning/10 border-warning/20",
  Filed: "text-success bg-success/10 border-success/20",
  "Port-Transit": "text-primary bg-primary/10 border-primary/20",
  Delivered: "text-success bg-success/10 border-success/20",
};

type SortKey = "date-desc" | "date-asc" | "cost-desc" | "cost-asc" | "weight-desc" | "weight-asc";

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function AllShipments() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("date-desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("shipments")
        .select("id, product_name, hs_code_assigned, status, e_factor_multiplier, raw_cost_v, freight, insurance, duty, taxes, total_weight_kg, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (data) setShipments(data as Shipment[]);
    } catch (e) {
      console.warn("Fetch failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchShipments(); }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("shipments").delete().eq("id", id);
      if (error) throw error;
      setShipments(prev => prev.filter(s => s.id !== id));
      toast({ title: "Shipment deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const totalCost = (s: Shipment) => (s.raw_cost_v + s.freight + s.insurance + s.duty + s.taxes) * s.e_factor_multiplier;

  const filtered = shipments
    .filter(s => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return s.product_name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "date-desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "date-asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "cost-desc": return totalCost(b) - totalCost(a);
        case "cost-asc": return totalCost(a) - totalCost(b);
        case "weight-desc": return (b.total_weight_kg || 0) - (a.total_weight_kg || 0);
        case "weight-asc": return (a.total_weight_kg || 0) - (b.total_weight_kg || 0);
        default: return 0;
      }
    });

  return (
    <AppLayout title="Archive" subtitle="All Shipments">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by product name or ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Calculated">Calculated</SelectItem>
              <SelectItem value="Filed">Filed</SelectItem>
              <SelectItem value="Port-Transit">Port-Transit</SelectItem>
              <SelectItem value="Delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-[180px] text-xs">
              <ArrowUpDown className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest First</SelectItem>
              <SelectItem value="date-asc">Oldest First</SelectItem>
              <SelectItem value="cost-desc">Highest Cost</SelectItem>
              <SelectItem value="cost-asc">Lowest Cost</SelectItem>
              <SelectItem value="weight-desc">Heaviest</SelectItem>
              <SelectItem value="weight-asc">Lightest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        <div className="bg-card rounded-lg border border-border shadow-card">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Shipments</span>
              <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <RefreshCw className="w-4 h-4 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No shipments match your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(s => {
                const cost = totalCost(s);
                return (
                  <div
                    key={s.id}
                    className="px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer flex items-center gap-4"
                    onClick={() => navigate(`/shipments/${s.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono font-medium text-primary">{s.id.slice(0, 8)}…</span>
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", STATUS_BADGE[s.status])}>{s.status}</span>
                        {s.e_factor_multiplier > 1.1 && (
                          <Badge variant="outline" className="text-[9px] border-warning/30 text-warning">E×{s.e_factor_multiplier.toFixed(2)}</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{s.product_name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {s.hs_code_assigned && <span>HS <strong className="text-foreground">{s.hs_code_assigned}</strong></span>}
                        {cost > 0 && <span>{fmtCurrency(cost)}</span>}
                        {s.total_weight_kg && <span>{s.total_weight_kg} kg</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-xs font-medium text-foreground">{new Date(s.created_at).toLocaleDateString("en-GB")}</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={e => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete shipment?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Permanently delete "{s.product_name}"? This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                            disabled={deletingId === s.id}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deletingId === s.id ? "Deleting…" : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
