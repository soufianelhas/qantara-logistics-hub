import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText, PackageOpen, Ship, Globe2, Star, Leaf, ShieldCheck,
  Sprout, Heart, Trees, Zap, Moon, Flag, CheckCircle2, Clock,
  AlertCircle, Upload, Brain, Printer, ChevronRight,
  ArrowLeft, Eye, Edit3, Send, RefreshCw, Building2, User, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useShipmentRecovery } from "@/hooks/use-shipment-recovery";
import {
  TARGET_MARKETS,
  buildChecklist,
  DOC_STATUS_META,
  INCOTERMS,
  CURRENCIES,
  type RequiredDocument,
  type DocStatus,
} from "@/data/document-rules";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExporterDetails {
  companyName: string;
  director: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  rc: string;
  ice: string;
  taxId: string;
  email: string;
  phone: string;
}

interface ConsigneeDetails {
  companyName: string;
  address: string;
  city: string;
  country: string;
  vatNumber: string;
  contactEmail: string;
}

const DEFAULT_EXPORTER: ExporterDetails = {
  companyName: "", director: "", address: "", city: "", postalCode: "",
  country: "Maroc", rc: "", ice: "", taxId: "", email: "", phone: "",
};

const DEFAULT_CONSIGNEE: ConsigneeDetails = {
  companyName: "", address: "", city: "", country: "", vatNumber: "", contactEmail: "",
};

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  "📄": FileText, "📦": PackageOpen, "🚢": Ship, "🏛️": Building2,
  "🇪🇺": Globe2, "🌿": Leaf, "🥗": ShieldCheck, "🌱": Sprout,
  "🏥": Heart, "🌿cites": Trees, "⚡": Zap, "☪️": Moon, "🇺🇸": Flag,
  "🇬🇧": Flag,
};

function DocIcon({ icon, className }: { icon: string; className?: string }) {
  const I = ICON_MAP[icon] ?? FileText;
  return <I className={className} />;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DocStatus }) {
  const meta = DOC_STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border", meta.color, meta.bg, meta.border)}>
      {status === "Missing" && <AlertCircle className="w-2.5 h-2.5" />}
      {status === "Draft"   && <Edit3 className="w-2.5 h-2.5" />}
      {status === "Ready"   && <CheckCircle2 className="w-2.5 h-2.5" />}
      {status === "Filed"   && <Send className="w-2.5 h-2.5" />}
      {meta.label}
    </span>
  );
}

// ─── Required fields per document type ────────────────────────────────────────

function getRequiredFields(docId: string): string[] {
  switch (docId) {
    case "commercial_invoice":
      return ["exporter.companyName", "exporter.address", "exporter.city", "consignee.companyName", "consignee.country", "quantity", "unitPrice"];
    case "eur1_certificate":
    case "certificate_of_origin":
      return ["exporter.companyName", "exporter.address", "exporter.city", "consignee.companyName", "consignee.country"];
    case "packing_list":
      return ["exporter.companyName", "consignee.companyName", "quantity"];
    case "bill_of_lading":
      return ["exporter.companyName", "consignee.companyName", "consignee.country"];
    default:
      return ["exporter.companyName", "exporter.city"];
  }
}

function checkFieldFilled(fieldPath: string, exporter: ExporterDetails, consignee: ConsigneeDetails, quantity: number, unitPrice: number): boolean {
  if (fieldPath === "quantity") return quantity > 0;
  if (fieldPath === "unitPrice") return unitPrice > 0;
  const [section, key] = fieldPath.split(".");
  if (section === "exporter") return !!(exporter as any)[key];
  if (section === "consignee") return !!(consignee as any)[key];
  return false;
}

function computeDocStatus(
  docId: string, exporter: ExporterDetails, consignee: ConsigneeDetails,
  quantity: number, unitPrice: number
): "Missing" | "Draft" | "Ready" {
  const required = getRequiredFields(docId);
  const filledCount = required.filter(f => checkFieldFilled(f, exporter, consignee, quantity, unitPrice)).length;
  if (filledCount === 0) return "Missing";
  if (filledCount >= required.length) return "Ready";
  return "Draft";
}

// ─── Document Preview templates ───────────────────────────────────────────────

function CommercialInvoicePreview({
  exporter, consignee, shipment, hsCode, productName, quantity, unitPrice, incoterm, currency, invoiceNo, invoiceDate,
}: {
  exporter: ExporterDetails; consignee: ConsigneeDetails; shipment: { freight: number };
  hsCode: string; productName: string; quantity: number; unitPrice: number;
  incoterm: string; currency: string; invoiceNo: string; invoiceDate: string;
}) {
  const total = quantity * unitPrice;
  const grandTotal = total + shipment.freight;
  return (
    <div className="bg-white text-gray-900 p-8 text-xs font-mono border border-gray-200 rounded-lg min-h-[600px] shadow-sm">
      <div className="border-b-2 border-gray-900 pb-4 mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-lg font-bold tracking-widest">COMMERCIAL INVOICE</h1>
          <p className="text-gray-500 text-[10px] mt-0.5">UN Layout Key for Trade Documents</p>
        </div>
        <div className="text-right">
          <p className="font-bold">No. {invoiceNo || "INV-2024-0001"}</p>
          <p className="text-gray-600">Date: {invoiceDate || new Date().toLocaleDateString("en-GB")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-gray-300 p-3">
          <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">1. Seller / Exporter</p>
          <p className="font-bold">{exporter.companyName || "[ Company Name ]"}</p>
          <p>{exporter.address || "[ Address ]"}</p>
          <p>{exporter.postalCode} {exporter.city || "[ City ]"}, {exporter.country}</p>
          <p className="text-gray-500 mt-1">RC: {exporter.rc || "—"} | ICE: {exporter.ice || "—"}</p>
          <p>{exporter.email || "—"}</p>
        </div>
        <div className="border border-gray-300 p-3">
          <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">2. Buyer / Consignee</p>
          <p className="font-bold">{consignee.companyName || "[ Buyer Company ]"}</p>
          <p>{consignee.address || "[ Address ]"}</p>
          <p>{consignee.city || "[ City ]"}, {consignee.country || "[ Country ]"}</p>
          <p className="text-gray-500 mt-1">VAT: {consignee.vatNumber || "—"}</p>
          <p>{consignee.contactEmail || "—"}</p>
        </div>
      </div>

      <div className="mb-4 border border-gray-300 p-3 grid grid-cols-3 gap-3 text-[10px]">
        <div><span className="text-gray-500">HS Code:</span> <strong>{hsCode || "—"}</strong></div>
        <div><span className="text-gray-500">Incoterms 2020:</span> <strong>{incoterm || "FOB"}</strong></div>
        <div><span className="text-gray-500">Currency:</span> <strong>{currency || "USD"}</strong></div>
        <div><span className="text-gray-500">Country of Origin:</span> <strong>MAROC (MA)</strong></div>
        <div><span className="text-gray-500">Port of Loading:</span> <strong>Agadir / Casablanca</strong></div>
        <div><span className="text-gray-500">Payment Terms:</span> <strong>T/T 30 days</strong></div>
      </div>

      <table className="w-full border-collapse mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-left">Description of Goods</th>
            <th className="border border-gray-300 p-2 text-center w-16">HS Code</th>
            <th className="border border-gray-300 p-2 text-right w-16">Qty</th>
            <th className="border border-gray-300 p-2 text-right w-24">Unit Price</th>
            <th className="border border-gray-300 p-2 text-right w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-300 p-2">{productName || "[ Product Description ]"}</td>
            <td className="border border-gray-300 p-2 text-center">{hsCode || "—"}</td>
            <td className="border border-gray-300 p-2 text-right">{quantity || 1}</td>
            <td className="border border-gray-300 p-2 text-right">{currency} {unitPrice.toFixed(2)}</td>
            <td className="border border-gray-300 p-2 text-right font-bold">{currency} {total.toFixed(2)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="border border-gray-300 p-2 text-right text-gray-500">Freight ({incoterm || "FOB"})</td>
            <td className="border border-gray-300 p-2 text-right">{currency} {(shipment.freight || 0).toFixed(2)}</td>
          </tr>
          <tr className="bg-gray-100 font-bold">
            <td colSpan={4} className="border border-gray-300 p-2 text-right">TOTAL</td>
            <td className="border border-gray-300 p-2 text-right">{currency} {grandTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Declaration</p>
          <p className="text-[10px] text-gray-600 leading-relaxed">
            I, the undersigned, declare that the goods described above have been produced or manufactured in Morocco and that the
            particulars shown herein are correct and complete.
          </p>
        </div>
        <div className="border-t border-gray-400 pt-2 text-right">
          <p className="text-[9px] text-gray-500 mb-8">Signature & Company Stamp</p>
          <p className="text-[10px]">{exporter.director || "[ Authorised Signatory ]"}</p>
          <p className="text-[10px] text-gray-500">{exporter.companyName || ""}</p>
        </div>
      </div>
    </div>
  );
}

function EUR1Preview({
  exporter, consignee, hsCode, productName, invoiceNo, invoiceDate,
}: {
  exporter: ExporterDetails; consignee: ConsigneeDetails;
  hsCode: string; productName: string; invoiceNo: string; invoiceDate: string;
}) {
  return (
    <div className="bg-white text-gray-900 p-6 text-xs border border-gray-300 rounded-lg shadow-sm min-h-[600px]">
      <div className="border-2 border-gray-800 p-1 mb-2">
        <div className="bg-gray-800 text-white text-center py-2 px-4 mb-2">
          <h1 className="text-base font-bold tracking-widest">MOVEMENT CERTIFICATE</h1>
          <p className="text-xs tracking-[0.3em] font-semibold">EUR.1</p>
        </div>
        <div className="text-center text-[9px] text-gray-600 mb-2">
          See notes for completion on the back of this form
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div className="border border-gray-400 p-2">
            <p className="text-[8px] uppercase tracking-wider text-gray-500 mb-1">1. Exporter (Name, full address, country)</p>
            <p className="font-semibold">{exporter.companyName || "[ Company Name ]"}</p>
            <p>{exporter.address || "[ Address ]"}</p>
            <p>{exporter.city}, {exporter.country}</p>
          </div>
          <div className="border border-gray-400 p-2">
            <p className="text-[8px] uppercase tracking-wider text-gray-500 mb-1">No.</p>
            <p className="text-lg font-bold font-mono">{invoiceNo || "MA-2024-00001"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px] mt-1">
          <div className="border border-gray-400 p-2">
            <p className="text-[8px] uppercase tracking-wider text-gray-500 mb-1">3. Consignee (Name, full address, country) — Optional</p>
            <p className="font-semibold">{consignee.companyName || "[ Consignee Name ]"}</p>
            <p>{consignee.city}, {consignee.country}</p>
          </div>
          <div className="border border-gray-400 p-2 space-y-1">
            <div>
              <p className="text-[8px] uppercase tracking-wider text-gray-500">4. Country of origin</p>
              <p className="font-bold">MAROC — MOROCCO</p>
            </div>
            <div>
              <p className="text-[8px] uppercase tracking-wider text-gray-500">5. Country of destination</p>
              <p className="font-semibold">{consignee.country || "[ Destination ]"}</p>
            </div>
          </div>
        </div>
        <div className="border border-gray-400 p-2 text-[10px] mt-1">
          <p className="text-[8px] uppercase tracking-wider text-gray-500 mb-1">8. Item number; description of goods; HS tariff heading</p>
          <div className="flex gap-6">
            <span>HS Code: <strong>{hsCode || "—"}</strong></span>
            <span>Description: <strong>{productName || "[ Description ]"}</strong></span>
          </div>
          <p className="mt-1 text-gray-500">Criterion: P (wholly obtained in Morocco)</p>
        </div>
        <div className="border border-gray-400 p-3 text-[10px] mt-1">
          <p className="text-[8px] uppercase tracking-wider text-gray-500 mb-1">11. Customs endorsement</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p>Declaration certified by:</p>
              <p className="font-semibold mt-1">Direction de l'Administration des Douanes et Impôts Indirects (ADII)</p>
              <p className="text-gray-500 mt-1">Date: {invoiceDate || new Date().toLocaleDateString("en-GB")}</p>
            </div>
            <div className="border-l border-gray-300 pl-4">
              <p className="text-[9px] text-gray-500 mb-6">Official stamp & signature</p>
              <p className="text-[9px] text-gray-400 italic">[ Cachet Douanes Marocaines ]</p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[9px] text-gray-400 text-center">
        Issued pursuant to the Euro-Mediterranean Agreement establishing an Association between the European Communities and Morocco (OJ L 70, 18.3.2000)
      </p>
    </div>
  );
}

function GenericDocPreview({ doc, exporter, hsCode, productName }: { doc: RequiredDocument; exporter: ExporterDetails; hsCode: string; productName: string }) {
  return (
    <div className="bg-white text-gray-900 p-8 text-xs border border-gray-200 rounded-lg shadow-sm min-h-[500px]">
      <div className="border-b-2 border-gray-900 pb-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 border border-gray-300 rounded flex items-center justify-center">
          <FileText className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-wide uppercase">{doc.label}</h1>
          <p className="text-[10px] text-gray-500">Issuing Authority: {doc.issuingAuthority}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-300 p-3">
          <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Exporter</p>
          <p className="font-bold">{exporter.companyName || "[ Company Name ]"}</p>
          <p>{exporter.address || "[ Address ]"}</p>
          <p>{exporter.city}, {exporter.country}</p>
        </div>
        <div className="border border-gray-300 p-3">
          <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Product Reference</p>
          <p>HS Code: <strong>{hsCode}</strong></p>
          <p>Product: <strong>{productName || "—"}</strong></p>
          <p className="text-gray-500 mt-1">Country of Origin: Morocco</p>
        </div>
      </div>
      <div className="border border-gray-300 p-4 bg-gray-50 mb-6">
        <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2">Description</p>
        <p className="text-gray-700 leading-relaxed">{doc.description}</p>
        {doc.sectorNote && <p className="text-[10px] text-blue-700 mt-2 italic">Note: {doc.sectorNote}</p>}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-8 border-t border-gray-300 pt-4">
        <div>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Applicant Signature</p>
          <p className="text-[10px] mt-6">{exporter.director || "[ Name & Title ]"}</p>
          <p className="text-[10px] text-gray-500">{exporter.companyName}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Issuing Authority</p>
          <p className="text-[10px] mt-6 font-semibold">{doc.issuingAuthority}</p>
          <p className="text-[9px] text-gray-400 italic mt-2">[ Official Stamp ]</p>
        </div>
      </div>
    </div>
  );
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

function generateAndPrintDocument(docId: string, previewRef: React.RefObject<HTMLDivElement>, docLabel: string) {
  if (!previewRef.current) return;
  const content = previewRef.current.innerHTML;
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html><head>
<title>${docLabel} — Qantara Export</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 20px; color: #111; }
  @media print { body { padding: 10mm; } @page { margin: 15mm; } }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 4px 8px; }
  .grid { display: grid; }
  .grid-cols-2 { grid-template-columns: 1fr 1fr; }
  .grid-cols-3 { grid-template-columns: 1fr 1fr 1fr; }
  .gap-1 { gap: 4px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
  .border { border: 1px solid #ccc; } .border-2 { border: 2px solid #333; }
  .border-b { border-bottom: 1px solid #ccc; } .border-b-2 { border-bottom: 2px solid #111; }
  .border-t { border-top: 1px solid #ccc; } .border-l { border-left: 1px solid #ccc; }
  .p-1 { padding: 4px; } .p-2 { padding: 8px; } .p-3 { padding: 12px; }
  .p-4 { padding: 16px; } .p-6 { padding: 24px; } .p-8 { padding: 32px; }
  .pb-4 { padding-bottom: 16px; } .pt-2 { padding-top: 8px; } .pt-4 { padding-top: 16px; } .pl-4 { padding-left: 16px; }
  .mb-1 { margin-bottom: 4px; } .mb-2 { margin-bottom: 8px; } .mb-4 { margin-bottom: 16px; }
  .mb-6 { margin-bottom: 24px; } .mt-1 { margin-top: 4px; } .mt-6 { margin-top: 24px; } .mt-8 { margin-top: 32px; }
  .text-right { text-align: right; } .text-center { text-align: center; } .text-left { text-align: left; }
  .font-bold { font-weight: bold; } .font-semibold { font-weight: 600; }
  .text-gray-400 { color: #9ca3af; } .text-gray-500 { color: #6b7280; } .text-gray-600 { color: #4b5563; }
  .text-gray-700 { color: #374151; } .text-white { color: white; }
  .bg-gray-100 { background: #f3f4f6; } .bg-gray-800 { background: #1f2937; } .bg-gray-50 { background: #f9fafb; }
  .italic { font-style: italic; } .uppercase { text-transform: uppercase; }
  .tracking-widest { letter-spacing: 0.1em; } .tracking-wide { letter-spacing: 0.05em; }
  .text-base { font-size: 14px; } .text-lg { font-size: 16px; } .text-xs { font-size: 11px; }
  .leading-relaxed { line-height: 1.6; } .flex { display: flex; }
  .items-start { align-items: flex-start; } .items-center { align-items: center; }
  .gap-6 { gap: 24px; } .gap-8 { gap: 32px; }
  .w-full { width: 100%; } .border-gray-300 { border-color: #d1d5db; } .border-gray-400 { border-color: #9ca3af; }
</style>
</head><body>${content}<script>window.onload=function(){window.print()}<\/script></body></html>`);
  win.document.close();
}

// ─── Passport Reader ──────────────────────────────────────────────────────────

function PassportReader({ onAutoFill }: { onAutoFill: (details: Partial<ExporterDetails>) => void }) {
  const [state, setState] = useState<"idle" | "processing" | "done">("idle");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState("processing");
    setTimeout(() => {
      setState("done");
      onAutoFill({
        companyName: "ARGANOR Export SARL",
        director: "Mohammed Alaoui Benali",
        address: "Rue Ibn Battouta 15, Quartier Industriel",
        city: "Casablanca",
        postalCode: "20250",
        country: "Maroc",
        rc: "RC 156234 — Casablanca",
        ice: "001584230000058",
        taxId: "35024891",
        email: "export@arganor.ma",
        phone: "+212 522 48 91 00",
      });
    }, 1800);
  };

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      state === "done" ? "border-risk-low/40 bg-risk-low/5" : "border-dashed border-primary/30 bg-primary/4"
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Passport / ID Reader — Auto-Fill</span>
        <Badge variant="outline" className="text-[10px] border-primary/25 text-primary ml-auto">AI OCR Simulation</Badge>
      </div>

      {state === "idle" && (
        <label className="flex flex-col items-center gap-2 cursor-pointer py-4">
          <Upload className="w-6 h-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">
            Upload exporter's ID, passport, or company registration document<br />
            <span className="text-primary font-medium">to auto-fill exporter details</span>
          </p>
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" className="pointer-events-none border-primary/30 text-primary text-xs">
            <Upload className="w-3.5 h-3.5" /> Upload Document
          </Button>
        </label>
      )}

      {state === "processing" && (
        <div className="flex items-center gap-3 py-3">
          <RefreshCw className="w-4 h-4 text-primary animate-spin" />
          <div>
            <p className="text-xs font-medium text-foreground">Processing document…</p>
            <p className="text-[11px] text-muted-foreground">Running OCR and extracting company details</p>
          </div>
        </div>
      )}

      {state === "done" && (
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-risk-low" />
          <div>
            <p className="text-xs font-semibold text-foreground">Exporter details auto-filled!</p>
            <p className="text-[11px] text-muted-foreground">Company information extracted and populated below</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function DocumentationWorkshop() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // URL params from LCE
  const paramHsCode      = searchParams.get("hs_code") || "";
  const paramProductName = searchParams.get("product_name") || "";
  const paramProductValue = parseFloat(searchParams.get("product_value") || "0");
  const paramFreight     = parseFloat(searchParams.get("freight") || "0");
  const urlShipmentId    = searchParams.get("shipment_id") || null;
  const fromLCE          = searchParams.get("from") === "lce";

  // ── Smart shipment recovery — accept Draft or Calculated ────────────────
  const { shipmentId, shipment: recoveredShipment, loading: recoveryLoading, recovered } = useShipmentRecovery(urlShipmentId, ["Draft", "Calculated"]);

  // Resolved data — may come from DB or URL params
  const [hsCode,       setHsCode]       = useState(paramHsCode);
  const [productName,  setProductName]  = useState(paramProductName);
  const [productValue, setProductValue] = useState(paramProductValue);
  const [freight,      setFreight]      = useState(paramFreight);
  const [loadedFromDB, setLoadedFromDB] = useState(false);
  const [dbLoading,    setDbLoading]    = useState(false);

  const [targetMarket, setTargetMarket] = useState("EU");
  const [checklist, setChecklist]       = useState<RequiredDocument[]>([]);
  const [manualStatuses, setManualStatuses] = useState<Record<string, DocStatus>>({});
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<"form" | "preview">("form");

  // Form state — persisted to localStorage
  const [exporter, setExporter]   = usePersistedState<ExporterDetails>("qantara_exporter", DEFAULT_EXPORTER);
  const [consignee, setConsignee] = usePersistedState<ConsigneeDetails>("qantara_consignee", DEFAULT_CONSIGNEE);
  const [quantity,  setQuantity]  = useState(1);
  const [unitPrice, setUnitPrice] = useState(paramProductValue);
  const [currency,  setCurrency]  = useState("USD");
  const [incoterm,  setIncoterm]  = useState("FOB");
  const [invoiceNo, setInvoiceNo] = useState(`INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString("en-GB"));
  const [savingDocId, setSavingDocId] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const [filingShipment, setFilingShipment] = useState(false);

  // ── Load recovered shipment data ──────────────────────────────────────────

  useEffect(() => {
    if (recovered && recoveredShipment && !loadedFromDB) {
      if (recoveredShipment.hs_code_assigned) setHsCode(recoveredShipment.hs_code_assigned);
      if (recoveredShipment.product_name) setProductName(recoveredShipment.product_name);
      if (recoveredShipment.raw_cost_v > 0) { setProductValue(recoveredShipment.raw_cost_v); setUnitPrice(recoveredShipment.raw_cost_v); }
      if (recoveredShipment.freight > 0) setFreight(recoveredShipment.freight);
      setLoadedFromDB(true);
      toast({ title: "Shipment recovered", description: `Resumed shipment: ${recoveredShipment.product_name || "Unnamed"}` });
    }
  }, [recovered, recoveredShipment]);

  // ── Fetch shipment from DB on load (explicit ID) ──────────────────────────

  useEffect(() => {
    if (!urlShipmentId || recovered) return;

    const fetchShipment = async () => {
      setDbLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("shipments")
          .select("hs_code_assigned, product_name, raw_cost_v, freight")
          .eq("id", urlShipmentId)
          .single();

        if (error || !data) return;

        if (data.hs_code_assigned) setHsCode(data.hs_code_assigned);
        if (data.product_name)     setProductName(data.product_name);
        if (data.raw_cost_v > 0)   { setProductValue(data.raw_cost_v); setUnitPrice(data.raw_cost_v); }
        if (data.freight > 0)      setFreight(data.freight);
        setLoadedFromDB(true);
      } catch (err) {
        console.warn("Could not fetch shipment:", err);
      } finally {
        setDbLoading(false);
      }
    };

    fetchShipment();
  }, [urlShipmentId, recovered]);

  useEffect(() => {
    if (productValue > 0) setUnitPrice(productValue);
  }, [productValue]);

  // Rebuild checklist when HS code or market changes
  useEffect(() => {
    if (!hsCode) return;
    const docs = buildChecklist(hsCode, targetMarket);
    setChecklist(docs);
    if (docs.length > 0 && !selectedDocId) setSelectedDocId(docs[0].id);
  }, [hsCode, targetMarket]);

  // ── Reactive auto-status computation ──────────────────────────────────────

  const statuses = useMemo(() => {
    const computed: Record<string, DocStatus> = {};
    for (const doc of checklist) {
      const manual = manualStatuses[doc.id];
      if (manual === "Filed") {
        computed[doc.id] = "Filed";
      } else {
        computed[doc.id] = computeDocStatus(doc.id, exporter, consignee, quantity, unitPrice);
      }
    }
    return computed;
  }, [checklist, exporter, consignee, quantity, unitPrice, manualStatuses]);

  // ── Auto-save documents to DB when status changes to Ready ────────────────
  const prevStatusesRef = useRef<Record<string, DocStatus>>({});

  useEffect(() => {
    if (!shipmentId) return;
    const prev = prevStatusesRef.current;
    const toSync = checklist.filter(doc => {
      const cur = statuses[doc.id];
      const was = prev[doc.id];
      return cur === "Ready" && was !== "Ready" && was !== "Filed";
    });
    prevStatusesRef.current = { ...statuses };

    if (toSync.length === 0) return;

    const syncDocs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        for (const doc of toSync) {
          await supabase.from("shipment_documents").upsert({
            user_id: user.id,
            shipment_id: shipmentId,
            document_type: doc.id,
            document_label: doc.label,
            target_market: targetMarket,
            status: "Ready" as any,
            metadata: { hs_code: hsCode, product_name: productName },
          }, { onConflict: "user_id,document_type,shipment_id" });
        }
        toast({ title: "Documents synced", description: `${toSync.length} document(s) auto-saved as Ready` });
      } catch { /* silent */ }
    };
    syncDocs();
  }, [statuses, shipmentId, checklist, targetMarket, hsCode, productName]);

  const readyCount = Object.values(statuses).filter(s => s === "Ready" || s === "Filed").length;
  const progressPercent = checklist.length > 0 ? Math.round((readyCount / checklist.length) * 100) : 0;

  const statusCounts = Object.values(statuses).reduce(
    (acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  const selectedDoc = checklist.find((d) => d.id === selectedDocId) ?? null;

  // ── Finalize button logic ─────────────────────────────────────────────────

  const criticalDocs = checklist.filter(d => d.urgency === "critical");
  const missingCritical = criticalDocs.filter(d => statuses[d.id] !== "Ready" && statuses[d.id] !== "Filed");
  const canFinalize = !!shipmentId && missingCritical.length === 0;

  const finalizeTooltip = useMemo(() => {
    const reasons: string[] = [];
    if (!shipmentId) reasons.push("No shipment linked — complete the full workflow first");
    if (missingCritical.length > 0) {
      reasons.push(`${missingCritical.length} critical doc(s) not Ready: ${missingCritical.map(d => d.abbreviation).join(", ")}`);
    }
    return reasons.join(" · ");
  }, [shipmentId, missingCritical]);

  const handleStatusChange = async (docId: string, newStatus: DocStatus) => {
    setManualStatuses((prev) => ({ ...prev, [docId]: newStatus }));
    setSavingDocId(docId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const doc = checklist.find((d) => d.id === docId);
        await supabase.from("shipment_documents").upsert({
          user_id: user.id,
          shipment_id: shipmentId || null,
          document_type: docId,
          document_label: doc?.label || docId,
          target_market: targetMarket,
          status: newStatus,
          generated_at: newStatus === "Filed" ? new Date().toISOString() : null,
          metadata: { hs_code: hsCode, product_name: productName },
        }, { onConflict: "user_id,document_type,shipment_id" });
        toast({ title: "Status updated", description: `${doc?.label} marked as ${newStatus}` });
      }
    } catch { /* silent - guest mode */ }
    setSavingDocId(null);
  };

  const handleGeneratePDF = (doc: RequiredDocument) => {
    generateAndPrintDocument(doc.id, previewRef, doc.label);
  };

  // ── Finalize & Export: mark shipment as "Filed" ───────────────────────────

  const handleFinalizeAndExport = async () => {
    if (!shipmentId) return;
    setFilingShipment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("shipments")
        .update({ status: "Filed" })
        .eq("id", shipmentId);

      if (error) throw error;

      const readyDocs = checklist.filter((d) => statuses[d.id] === "Ready");
      for (const doc of readyDocs) {
        await handleStatusChange(doc.id, "Filed");
      }

      toast({
        title: "✓ Shipment Filed",
        description: "Shipment status updated to 'Filed'. All ready documents have been filed with PortNet.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to file shipment";
      toast({ title: "Filing failed", description: msg, variant: "destructive" });
    } finally {
      setFilingShipment(false);
    }
  };

  const handleAutoFill = (details: Partial<ExporterDetails>) => {
    setExporter((prev) => ({ ...prev, ...details }));
    toast({ title: "Exporter details populated!", description: "Data extracted from uploaded document" });
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderDocumentPreview = () => {
    if (!selectedDoc) return null;
    if (selectedDoc.id === "commercial_invoice") {
      return <CommercialInvoicePreview
        exporter={exporter} consignee={consignee}
        shipment={{ freight }} hsCode={hsCode} productName={productName}
        quantity={quantity} unitPrice={unitPrice} incoterm={incoterm}
        currency={currency} invoiceNo={invoiceNo} invoiceDate={invoiceDate}
      />;
    }
    if (selectedDoc.id === "eur1_certificate") {
      return <EUR1Preview exporter={exporter} consignee={consignee}
        hsCode={hsCode} productName={productName} invoiceNo={invoiceNo} invoiceDate={invoiceDate} />;
    }
    return <GenericDocPreview doc={selectedDoc} exporter={exporter} hsCode={hsCode} productName={productName} />;
  };

  const renderForm = () => {
    if (!selectedDoc) return null;
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Passport Reader — only for exporter-details-heavy docs */}
        {["commercial_invoice", "eur1_certificate", "certificate_of_origin"].includes(selectedDoc.id) && (
          <PassportReader onAutoFill={handleAutoFill} />
        )}

        {/* Exporter section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Exporter Details</span>
            <Badge variant="outline" className="text-[9px] border-primary/25 text-primary ml-auto">Saved to local storage</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Company Name" value={exporter.companyName} onChange={(v) => setExporter((p) => ({ ...p, companyName: v }))} placeholder="ARGANOR Export SARL" />
            <FormField label="Director / Signatory" value={exporter.director} onChange={(v) => setExporter((p) => ({ ...p, director: v }))} placeholder="Mohammed Alaoui" />
            <div className="col-span-2">
              <FormField label="Street Address" value={exporter.address} onChange={(v) => setExporter((p) => ({ ...p, address: v }))} placeholder="Rue Ibn Battouta 15, Quartier Industriel" />
            </div>
            <FormField label="City" value={exporter.city} onChange={(v) => setExporter((p) => ({ ...p, city: v }))} placeholder="Casablanca" />
            <FormField label="Postal Code" value={exporter.postalCode} onChange={(v) => setExporter((p) => ({ ...p, postalCode: v }))} placeholder="20250" />
            <FormField label="ICE Number" value={exporter.ice} onChange={(v) => setExporter((p) => ({ ...p, ice: v }))} placeholder="001584230000058" />
            <FormField label="RC Number" value={exporter.rc} onChange={(v) => setExporter((p) => ({ ...p, rc: v }))} placeholder="RC 156234 — Casablanca" />
            <FormField label="Email" value={exporter.email} onChange={(v) => setExporter((p) => ({ ...p, email: v }))} placeholder="export@company.ma" />
            <FormField label="Phone" value={exporter.phone} onChange={(v) => setExporter((p) => ({ ...p, phone: v }))} placeholder="+212 5XX XX XX XX" />
          </div>
        </div>

        {/* Consignee section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <User className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Consignee / Buyer</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Company Name" value={consignee.companyName} onChange={(v) => setConsignee((p) => ({ ...p, companyName: v }))} placeholder="EU Importer GmbH" />
            <FormField label="VAT Number" value={consignee.vatNumber} onChange={(v) => setConsignee((p) => ({ ...p, vatNumber: v }))} placeholder="DE 123456789" />
            <div className="col-span-2">
              <FormField label="Address" value={consignee.address} onChange={(v) => setConsignee((p) => ({ ...p, address: v }))} placeholder="Musterstraße 12" />
            </div>
            <FormField label="City" value={consignee.city} onChange={(v) => setConsignee((p) => ({ ...p, city: v }))} placeholder="Hamburg" />
            <FormField label="Country" value={consignee.country} onChange={(v) => setConsignee((p) => ({ ...p, country: v }))} placeholder="Germany" />
          </div>
        </div>

        {/* Shipment details */}
        {["commercial_invoice", "packing_list"].includes(selectedDoc.id) && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Ship className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Shipment Details</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">HS Code</Label>
                <Input value={hsCode} readOnly className="bg-muted/50 text-muted-foreground border-dashed text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Incoterms</Label>
                <Select value={incoterm} onValueChange={setIncoterm}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{INCOTERMS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <FormField label="Quantity" type="number" value={String(quantity)} onChange={(v) => setQuantity(Number(v))} placeholder="1" />
              <FormField label={`Unit Price (${currency})`} type="number" value={String(unitPrice)} onChange={(v) => setUnitPrice(Number(v))} placeholder="0.00" />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Total</Label>
                <Input value={`${currency} ${(quantity * unitPrice).toFixed(2)}`} readOnly className="bg-primary/5 border-primary/20 text-xs font-mono font-semibold text-primary" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────

  return (
    <AppLayout title="Documentation Workshop" subtitle="Smart Checklist · Auto-Filler · PDF Generator">
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* Stepper */}
        <WorkflowStepper currentStep={3} />

        {/* Loading state */}
        {(dbLoading || recoveryLoading) && (
          <div className="rounded-xl border border-primary/20 bg-primary/6 px-4 py-3 flex items-center gap-3 animate-fade-in">
            <RefreshCw className="w-4 h-4 text-primary animate-spin shrink-0" />
            <p className="text-xs text-muted-foreground">Loading shipment data…</p>
          </div>
        )}

        {/* Recovered shipment banner */}
        {recovered && !dbLoading && !recoveryLoading && (
          <div className="rounded-xl border border-risk-low/30 bg-risk-low/6 px-4 py-3 flex items-center gap-3 animate-fade-in">
            <Database className="w-4 h-4 text-risk-low shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">
                Shipment auto-recovered: <span className="text-primary">{recoveredShipment?.product_name || "Unnamed"}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Most recent Calculated shipment loaded automatically.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] border-risk-low/40 text-risk-low gap-1 shrink-0">
              <Database className="w-2.5 h-2.5" /> Recovered
            </Badge>
          </div>
        )}

        {/* Context banner */}
        {(hsCode || productName) && !dbLoading && !recoveryLoading && !recovered && (
          <div className="rounded-xl border border-primary/20 bg-primary/6 px-4 py-3 flex items-center gap-3 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">
                Generating documentation for{" "}
                <span className="text-primary">{productName || "selected product"}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                HS code <span className="font-mono font-bold text-foreground">{hsCode}</span>
                {productValue > 0 && <> · Value ${productValue.toLocaleString()}</>}
                {freight > 0 && <> · Freight ${freight.toLocaleString()}</>}
              </p>
            </div>
            {loadedFromDB && (
              <Badge variant="outline" className="text-[10px] border-risk-low/40 text-risk-low gap-1 shrink-0">
                <Database className="w-2.5 h-2.5" /> Loaded from shipment
              </Badge>
            )}
            {fromLCE && (
              <button onClick={() => navigate(-1)} className="text-[11px] text-primary hover:underline flex items-center gap-1 shrink-0">
                <ArrowLeft className="w-3 h-3" /> Back to LCE
              </button>
            )}
          </div>
        )}

        {/* Target Market */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-foreground">Target Market:</span>
          {TARGET_MARKETS.map((m) => (
            <button
              key={m.value}
              onClick={() => setTargetMarket(m.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                targetMarket === m.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              <span>{m.flag}</span>
              {m.label}
            </button>
          ))}
        </div>

        {/* Progress bar + summary */}
        {checklist.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-xl">
              <span className="text-xs font-semibold text-foreground">Document Progress:</span>
              {(["Missing", "Draft", "Ready", "Filed"] as DocStatus[]).map((s) => {
                const n = statusCounts[s] || 0;
                if (n === 0) return null;
                const meta = DOC_STATUS_META[s];
                return (
                  <span key={s} className={cn("text-xs font-semibold flex items-center gap-1", meta.color)}>
                    <span className={cn("inline-block w-2 h-2 rounded-full", meta.bg, "border", meta.border)} />
                    {n} {s}
                  </span>
                );
              })}
              <span className="ml-auto text-xs font-semibold text-foreground">
                {readyCount} / {checklist.length} complete
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* No HS code state */}
        {!hsCode && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">No HS Code provided</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Start from the HS Neural-Navigator to classify your product, then proceed through the Landed Cost Engine before reaching this module.
            </p>
            <Button size="sm" className="mt-4" onClick={() => navigate("/hs-navigator")}>
              Start Classification →
            </Button>
          </div>
        )}

        {/* Main split-screen workspace */}
        {checklist.length > 0 && (
          <div className="grid grid-cols-5 gap-5" style={{ minHeight: "680px" }}>

            {/* ── LEFT: Smart Checklist (2 cols) ──────────────────────── */}
            <div className="col-span-2 flex flex-col gap-3 overflow-y-auto pr-1">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Required Documents ({checklist.length})
              </h2>

              {checklist.map((doc) => {
                const status  = statuses[doc.id] ?? "Missing";
                const meta    = DOC_STATUS_META[status];
                const isSelected = selectedDocId === doc.id;
                const isSaving  = savingDocId === doc.id;

                return (
                  <button
                    key={doc.id}
                    onClick={() => { setSelectedDocId(doc.id); setActiveTab("form"); }}
                    className={cn(
                      "w-full text-left p-3.5 rounded-xl border transition-all duration-150",
                      isSelected
                        ? "border-primary bg-primary/8 shadow-sm"
                        : "border-border bg-card hover:border-primary/25 hover:bg-primary/4"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0", meta.bg, "border", meta.border)}>
                        <DocIcon icon={doc.icon} className={cn("w-4 h-4", meta.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={cn("text-[10px] font-bold tracking-wider uppercase", meta.color)}>
                            {doc.abbreviation}
                          </span>
                          {doc.urgency === "critical" && (
                            <span className="text-[9px] font-semibold text-risk-high bg-risk-high/10 px-1.5 py-0.5 rounded-sm border border-risk-high/20">
                              Required
                            </span>
                          )}
                          {isSaving && <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />}
                        </div>
                        <p className="text-xs font-medium text-foreground leading-tight truncate">{doc.label}</p>
                        <div className="flex items-center justify-between mt-2">
                          <StatusBadge status={status} />
                          {isSelected && <ChevronRight className="w-3 h-3 text-primary" />}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── RIGHT: Document Workspace (3 cols) ───────────────────── */}
            <div className="col-span-3 flex flex-col bg-card border border-border rounded-xl overflow-hidden">

              {!selectedDoc ? (
                <div className="flex-1 flex items-center justify-center text-center p-12">
                  <div>
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground">Select a document</p>
                    <p className="text-xs text-muted-foreground mt-1">Click a document from the checklist to fill in details and generate a PDF</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Doc header */}
                  <div className="flex items-start gap-3 p-4 border-b border-border">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">{selectedDoc.label}</h3>
                        <StatusBadge status={statuses[selectedDoc.id] ?? "Missing"} />
                        {selectedDoc.urgency === "critical" && (
                          <Badge variant="outline" className="text-[10px] border-risk-high/30 text-risk-high">Required</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium text-foreground">Authority:</span> {selectedDoc.issuingAuthority}
                        <span className="mx-2 text-border">·</span>
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {selectedDoc.estimatedDays}d est.
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 italic">{selectedDoc.reason}</p>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-border">
                    {(["form", "preview"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                          activeTab === tab
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tab === "form" ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {tab === "form" ? "Fill Form" : "Preview"}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === "form" && renderForm()}
                    {activeTab === "preview" && (
                      <div ref={previewRef} className="animate-fade-in">
                        {renderDocumentPreview()}
                      </div>
                    )}
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center gap-2 p-4 border-t border-border bg-muted/20 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/30 text-primary hover:bg-primary/5 text-xs"
                      onClick={() => { setActiveTab("preview"); setTimeout(() => handleGeneratePDF(selectedDoc), 200); }}
                    >
                      <Printer className="w-3.5 h-3.5" /> Generate PDF
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="border-risk-low/40 text-risk-low hover:bg-risk-low/5 text-xs ml-auto"
                      onClick={() => handleStatusChange(selectedDoc.id, "Filed")}
                    >
                      <Send className="w-3.5 h-3.5" /> File w/ PortNet
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Finalize & Export ─────────────────────────────────────── */}
        {checklist.length > 0 && (
          <div className="rounded-xl border-2 border-success/40 bg-success/6 px-5 py-4 flex items-center gap-4 animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-success/15 border border-success/30 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Finalize & Export Shipment</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Marks the shipment as <strong className="text-foreground">Filed</strong> and files all Ready documents with PortNet.
                {!canFinalize && finalizeTooltip && (
                  <span className="text-warning font-medium ml-1">⚠ {finalizeTooltip}</span>
                )}
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="shrink-0">
                    <Button
                      onClick={handleFinalizeAndExport}
                      disabled={filingShipment || !canFinalize}
                      className="shrink-0 bg-success text-white hover:bg-success/90 h-10 text-sm font-semibold gap-2 shadow-md"
                    >
                      {filingShipment ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Filing…</>
                      ) : (
                        <><Send className="w-4 h-4" /> Finalize & Export</>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canFinalize && (
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {finalizeTooltip}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

// ─── Inline FormField helper ──────────────────────────────────────────────────

function FormField({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-xs" />
    </div>
  );
}
