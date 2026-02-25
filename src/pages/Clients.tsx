import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  Users, Plus, Search, Edit, Trash2, Mail, Phone, MapPin, RefreshCw,
  ArrowRight, Package, Building,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string | null;
  tax_id: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  shipment_count?: number;
}

interface ClientFormData {
  name: string;
  email: string;
  tax_id: string;
  phone: string;
  address: string;
}

const emptyForm: ClientFormData = { name: "", email: "", tax_id: "", phone: "", address: "" };

export default function Clients() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<ClientFormData>(emptyForm);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientShipments, setClientShipments] = useState<any[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientsData } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (clientsData) {
        // Get shipment counts
        const { data: shipments } = await supabase
          .from("shipments")
          .select("client_id")
          .eq("user_id", user.id)
          .not("client_id", "is", null);

        const countMap: Record<string, number> = {};
        shipments?.forEach((s: any) => {
          countMap[s.client_id] = (countMap[s.client_id] || 0) + 1;
        });

        setClients(clientsData.map((c: any) => ({ ...c, shipment_count: countMap[c.id] || 0 })));
      }
    } catch {
      toast({ title: "Failed to load clients", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Client name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingClient) {
        const { error } = await supabase.from("clients").update({
          name: formData.name, email: formData.email || null,
          tax_id: formData.tax_id || null, phone: formData.phone || null,
          address: formData.address || null,
        }).eq("id", editingClient.id);
        if (error) throw error;
        toast({ title: "Client updated" });
      } else {
        const { error } = await supabase.from("clients").insert({
          user_id: user.id, name: formData.name,
          email: formData.email || null, tax_id: formData.tax_id || null,
          phone: formData.phone || null, address: formData.address || null,
        } as any);
        if (error) throw error;
        toast({ title: "Client added" });
      }
      setDialogOpen(false);
      setFormData(emptyForm);
      setEditingClient(null);
      fetchClients();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      setClients(prev => prev.filter(c => c.id !== id));
      if (selectedClient?.id === id) setSelectedClient(null);
      toast({ title: "Client deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name, email: client.email || "",
      tax_id: client.tax_id || "", phone: client.phone || "",
      address: client.address || "",
    });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingClient(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const handleSelectClient = async (client: Client) => {
    setSelectedClient(client);
    setLoadingShipments(true);
    try {
      const { data } = await supabase
        .from("shipments")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });
      setClientShipments(data || []);
    } catch {
      setClientShipments([]);
    } finally {
      setLoadingShipments(false);
    }
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AppLayout title="Client Management" subtitle="CRM Portfolio">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-1 max-w-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search clients…" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>
          <Button onClick={openAdd} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
            <Plus className="w-4 h-4" /> Add Client
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Client List */}
          <div className="xl:col-span-3 bg-card rounded-lg border border-border shadow-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Clients</h2>
                <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
              </div>
            </div>
            <div className="divide-y divide-border">
              {loading && (
                <div className="px-5 py-8 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">Loading…</span>
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">No clients yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Add your first client to get started</p>
                </div>
              )}
              {filtered.map((client) => (
                <div key={client.id}
                  className={cn(
                    "px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors",
                    selectedClient?.id === client.id && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                  onClick={() => handleSelectClient(client)}>
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Building className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {client.email}</span>}
                      {client.tax_id && <span>ICE: {client.tax_id}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Package className="w-2.5 h-2.5" /> {client.shipment_count}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(client.created_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); openEdit(client); }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete client?</AlertDialogTitle>
                          <AlertDialogDescription>Delete "{client.name}"? Linked shipments will keep their data but lose the client link.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(client.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Client Detail Panel */}
          <div className="xl:col-span-2 bg-card rounded-lg border border-border shadow-card">
            {!selectedClient ? (
              <div className="px-5 py-12 text-center">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Select a client</p>
                <p className="text-xs text-muted-foreground mt-1">Click a client to view their shipments</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">{selectedClient.name}</h3>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {selectedClient.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {selectedClient.email}</p>}
                    {selectedClient.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {selectedClient.phone}</p>}
                    {selectedClient.address && <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {selectedClient.address}</p>}
                    {selectedClient.tax_id && <p>ICE: <span className="font-mono font-medium text-foreground">{selectedClient.tax_id}</span></p>}
                  </div>
                </div>
                <div className="px-5 py-3 border-b border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Linked Shipments</p>
                </div>
                <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                  {loadingShipments && (
                    <div className="py-6 flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground">Loading…</span>
                    </div>
                  )}
                  {!loadingShipments && clientShipments.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted-foreground">No shipments linked</div>
                  )}
                  {clientShipments.map((s: any) => (
                    <div key={s.id} className="px-5 py-3 hover:bg-muted/30 cursor-pointer transition-colors flex items-center gap-3"
                      onClick={() => navigate(`/shipments/${s.id}`)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{s.product_name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.status} · {new Date(s.created_at).toLocaleDateString("en-GB")}</p>
                      </div>
                      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Company name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ICE (Tax ID)</Label>
                  <Input value={formData.tax_id} onChange={(e) => setFormData(prev => ({ ...prev, tax_id: e.target.value }))} placeholder="000000000000000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="+212 600 000 000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</Label>
                <Input value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} placeholder="Street, City, Country" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</> : editingClient ? "Update" : "Add Client"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
