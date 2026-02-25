import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Ship, AlertTriangle, Wind, Eye, Thermometer, Anchor, CloudLightning,
  TrendingUp, FileText, CheckCircle2, Clock, ArrowRight, RefreshCw,
  Package, MapPin, Calendar, Leaf, Trash2, Edit3, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type ShipmentStatus = "Draft" | "Calculated" | "Filed" | "Port-Transit" | "Delivered";
type DocumentStatus = "Missing" | "Draft" | "Ready" | "Filed";

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
  created_at: string;
  updated_at: string;
  port_congestion_level: string | null;
  weather_risk_level: string | null;
  notes: string | null;
  origin_city: string | null;
  destination_city: string | null;
  total_weight_kg: number | null;
}

interface ShipmentDocument {
  id: string;
  document_label: string;
  document_type: string;
  status: DocumentStatus;
  file_path: string | null;
  metadata: Record<string, any> | null;
  generated_at: string | null;
  updated_at: string;
}

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
  portCongestion: string;
  stormRisk: string;
  multiplier: number;
  ports: PortWeather[];
  breakdown: { base: number; windContribution: number; congestionContribution: number; totalDelayDays: number };
}

const STATUS_STYLE: Record<ShipmentStatus, string> = {
  Draft: "bg-muted text-muted-foreground border-border",
  Calculated: "bg-warning/10 text-warning border-warning/20",
  Filed: "bg-success/10 text-success border-success/20",
  "Port-Transit": "bg-primary/10 text-primary border-primary/20",
  Delivered: "bg-success/10 text-success border-success/20",
};

const DOC_STATUS_ICON: Record<DocumentStatus, { icon: typeof CheckCircle2; color: string }> = {
  Missing: { icon: AlertTriangle, color: "text-risk-high" },
  Draft: { icon: Clock, color: "text-warning" },
  Ready: { icon: CheckCircle2, color: "text-success" },
  Filed: { icon: CheckCircle2, color: "text-primary" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

export default function ShipmentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [eFactor, setEFactor] = useState<EFactorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      setLoading(true);
      const [shipRes, docRes] = await Promise.all([
        supabase.from("shipments").select("*").eq("id", id).single(),
        supabase.from("shipment_documents").select("id, document_label, document_type, status, file_path, metadata, generated_at, updated_at").eq("shipment_id", id),
      ]);
      if (shipRes.data) setShipment(shipRes.data as unknown as Shipment);
      if (docRes.data) setDocuments(docRes.data as unknown as ShipmentDocument[]);

      try {
        const { data } = await supabase.functions.invoke("weather-efactor");
        if (data && !data.error) setEFactor(data as EFactorData);
      } catch {}
      setLoading(false);
    };
    fetchAll();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("shipments").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Shipment deleted", description: "Shipment has been permanently removed." });
      navigate("/");
    } catch (err: unknown) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Shipment Details" subtitle="Loading...">
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!shipment) {
    return (
      <AppLayout title="Shipment Not Found" subtitle="">
        <div className="text-center py-20">
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">This shipment does not exist or you don't have access.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>Back to Dashboard</Button>
        </div>
      </AppLayout>
    );
  }

  const status = shipment.status as ShipmentStatus;
  const totalBase = shipment.raw_cost_v + shipment.freight + shipment.insurance + shipment.duty + shipment.taxes;
  const optimistic = totalBase;
  const realistic = totalBase * shipment.e_factor_multiplier;
  const liveMultiplier = eFactor?.multiplier ?? shipment.e_factor_multiplier;
  const showAlert = (status === "Draft" || status === "Calculated") && liveMultiplier > 1.2;
  const readyDocs = documents.filter(d => d.status === "Ready" || d.status === "Filed").length;
  const docProgress = documents.length > 0 ? (readyDocs / documents.length) * 100 : 0;

  const resumeRoute = status === "Draft" ? "/landed-cost" : "/documentation-workshop";
  const resumeParams = new URLSearchParams({ shipment_id: shipment.id, product_name: shipment.product_name });
  if (shipment.hs_code_assigned) resumeParams.set("hs_code", shipment.hs_code_assigned);

  const editSpecsUrl = `/landed-cost?shipment_id=${shipment.id}&product_name=${encodeURIComponent(shipment.product_name)}${shipment.hs_code_assigned ? `&hs_code=${shipment.hs_code_assigned}` : ""}`;

  const handleEditDocument = (doc: ShipmentDocument) => {
    const params = new URLSearchParams({
      shipment_id: shipment.id,
      product_name: shipment.product_name,
      doc_type: doc.document_type,
    });
    if (shipment.hs_code_assigned) params.set("hs_code", shipment.hs_code_assigned);
    navigate(`/documentation-workshop?${params.toString()}`);
  };

  return (
    <AppLayout title="Shipment Details" subtitle={shipment.product_name}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate("/")} className="text-xs">
            ← Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => navigate(editSpecsUrl)}>
              <Edit3 className="w-3.5 h-3.5" /> Edit Specifications
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="w-3.5 h-3.5" /> Delete Shipment
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this shipment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{shipment.product_name}" and all associated documents. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleting ? "Deleting…" : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Strategic Alert Banner */}
        {showAlert && (
          <div className="rounded-xl border-2 border-risk-high/50 bg-risk-high/10 px-5 py-4 flex items-start gap-4 animate-fade-in">
            <div className="w-9 h-9 rounded-full bg-risk-high/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-risk-high" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">⚠ STRATEGIC ALERT: High transit risk detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Live E-Factor is ×{liveMultiplier.toFixed(4)}. Consider delaying filing or switching to Road/Air transport.
              </p>
              <Button size="sm" className="mt-2 text-xs" onClick={() => navigate(`${resumeRoute}?${resumeParams.toString()}`)}>
                Resume Workflow <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Four Quadrant Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Q1: Core Logistics Identity */}
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Package className="w-4 h-4 text-primary" /> Core Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={cn("text-xs font-semibold px-3 py-1 rounded-full border", STATUS_STYLE[status])}>
                  {status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Product</p>
                  <p className="font-medium text-foreground">{shipment.product_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">HS Code</p>
                  <p className="font-mono font-semibold text-foreground">{shipment.hs_code_assigned || "Pending"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Origin</p>
                  <p className="font-medium text-foreground">{shipment.origin_city || "Casablanca"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Destination</p>
                  <p className="font-medium text-foreground">{shipment.destination_city || "EU"}</p>
                </div>
                {shipment.total_weight_kg && (
                  <div>
                    <p className="text-muted-foreground">Weight</p>
                    <p className="font-medium text-foreground">{shipment.total_weight_kg} kg</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Created</p>
                  <p className="font-medium text-foreground">{new Date(shipment.created_at).toLocaleDateString("en-GB")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="font-medium text-foreground">{new Date(shipment.updated_at).toLocaleDateString("en-GB")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Q2: Cost & Rate Summary */}
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <TrendingUp className="w-4 h-4 text-primary" /> Cost & Rate Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5 text-xs">
                {[
                  { label: "V — Product Value", value: shipment.raw_cost_v },
                  { label: "F — Freight", value: shipment.freight },
                  { label: "I — Insurance", value: shipment.insurance },
                  { label: "D — Duty", value: shipment.duty },
                  { label: "T — Tax", value: shipment.taxes },
                ].map(item => (
                  <div key={item.label} className="flex justify-between">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono text-foreground">{fmt(item.value)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">E-Factor</span>
                    <span className="font-mono text-foreground">×{shipment.e_factor_multiplier.toFixed(4)}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Optimistic</p>
                  <p className="text-lg font-bold font-mono text-primary">{fmt(optimistic)}</p>
                </div>
                <div className="rounded-lg bg-risk-high/5 border border-risk-high/15 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Realistic</p>
                  <p className="text-lg font-bold font-mono text-risk-high">{fmt(realistic)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Q3: E-Factor & Weather Snapshot */}
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wind className="w-4 h-4 text-primary" /> E-Factor & Weather
                {eFactor && <Badge variant="outline" className="ml-auto text-[10px]">Live</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {eFactor ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {eFactor.ports.map(p => (
                      <div key={p.port} className="rounded-lg border border-border bg-card p-2.5 space-y-1.5 text-[11px]">
                        <p className="font-semibold text-foreground text-xs">{p.portName}</p>
                        <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Wind className="w-2.5 h-2.5" /> Wind</span><span className={cn("font-mono font-bold", p.windSpeedKnots > 25 ? "text-risk-high" : p.windSpeedKnots > 18 ? "text-warning" : "text-risk-low")}>{p.windSpeedKnots} kn</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Eye className="w-2.5 h-2.5" /> Vis</span><span className="font-mono text-foreground">{(p.visibility / 1000).toFixed(1)} km</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Thermometer className="w-2.5 h-2.5" /> Temp</span><span className="font-mono text-foreground">{p.temperature.toFixed(0)}°C</span></div>
                        {p.hasStormAlert && <Badge variant="outline" className="text-[8px] border-risk-high/30 text-risk-high">⚠ Storm</Badge>}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border border-border p-2.5">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1"><Anchor className="w-3 h-3" /> Congestion</div>
                      <p className="font-semibold text-foreground capitalize">{eFactor.portCongestion}</p>
                    </div>
                    <div className="rounded-lg border border-border p-2.5">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1"><CloudLightning className="w-3 h-3" /> Storm Risk</div>
                      <p className="font-semibold text-foreground capitalize">{eFactor.stormRisk}</p>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1"><TrendingUp className="w-3 h-3" /> E-Factor</div>
                      <p className="font-bold font-mono text-primary text-lg">×{eFactor.multiplier.toFixed(4)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Weather data unavailable. E-Factor at time of calculation: ×{shipment.e_factor_multiplier.toFixed(4)}</p>
              )}
            </CardContent>
          </Card>

          {/* Q4: Compliance & Documents */}
          <Card className="border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="w-4 h-4 text-primary" /> Compliance & Documents
                {documents.length > 0 && (
                  <Badge variant="outline" className="ml-auto text-[10px]">{readyDocs}/{documents.length} ready</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {documents.length > 0 ? (
                <>
                  <Progress value={docProgress} className="h-2" />
                  <div className="space-y-2">
                    {documents.map(doc => {
                      const docStatus = doc.status as DocumentStatus;
                      const statusInfo = DOC_STATUS_ICON[docStatus] || DOC_STATUS_ICON.Missing;
                      const Icon = statusInfo.icon;
                      const meta = doc.metadata as Record<string, any> | null;
                      return (
                        <div key={doc.id} className="rounded-lg border border-border p-2.5 group hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-2 text-xs">
                            <Icon className={cn("w-3.5 h-3.5 shrink-0", statusInfo.color)} />
                            <span className="flex-1 font-medium text-foreground">{doc.document_label}</span>
                            <button
                              onClick={() => handleEditDocument(doc)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                              title="Edit document"
                            >
                              <Pencil className="w-3 h-3 text-muted-foreground hover:text-primary" />
                            </button>
                            <Badge variant="outline" className={cn("text-[9px]", statusInfo.color)}>
                              {docStatus}
                            </Badge>
                          </div>
                          {meta && (
                            <div className="mt-1.5 pl-5.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                              {meta.hs_code && <span>HS: {meta.hs_code}</span>}
                              {(meta.exporter?.companyName || meta.exporter_company) && (
                                <span>Exp: {meta.exporter?.companyName || meta.exporter_company}</span>
                              )}
                              {meta.quantity && <span>Qty: {meta.quantity}</span>}
                              {doc.generated_at && (
                                <span>Filed: {new Date(doc.generated_at).toLocaleDateString("en-GB")}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {(status === "Draft" || status === "Calculated") && (
                    <Button variant="outline" size="sm" className="w-full text-xs mt-2" onClick={() => navigate(`/documentation-workshop?${resumeParams.toString()}`)}>
                      Open Documentation Workshop <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <FileText className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No documents generated yet</p>
                  {(status === "Draft" || status === "Calculated") && (
                    <Button size="sm" className="mt-2 text-xs" onClick={() => navigate(`/documentation-workshop?${resumeParams.toString()}`)}>
                      Generate Documents <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
