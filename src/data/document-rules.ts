// ─────────────────────────────────────────────────────────────────────────────
// Qantara — Documentation Workshop: Smart Checklist Logic Engine
// Determines required export documents based on HS code and target market
// ─────────────────────────────────────────────────────────────────────────────

export type DocStatus = "Missing" | "Draft" | "Ready" | "Filed";

export interface DocumentDefinition {
  id: string;
  label: string;
  abbreviation: string;
  description: string;
  issuingAuthority: string;
  urgency: "critical" | "high" | "medium";
  estimatedDays: number;
  icon: string;
}

export interface RequiredDocument extends DocumentDefinition {
  reason: string;
  sectorNote?: string;
}

export interface TargetMarket {
  value: string;
  label: string;
  flag: string;
}

// ─── Target Markets ───────────────────────────────────────────────────────────

export const TARGET_MARKETS: TargetMarket[] = [
  { value: "EU",    label: "European Union",    flag: "🇪🇺" },
  { value: "UK",    label: "United Kingdom",    flag: "🇬🇧" },
  { value: "USA",   label: "United States",     flag: "🇺🇸" },
  { value: "GCC",   label: "Gulf / GCC States", flag: "🌙" },
  { value: "OTHER", label: "Other Markets",     flag: "🌍" },
];

// ─── Document Catalog ─────────────────────────────────────────────────────────

const DOCS: Record<string, DocumentDefinition> = {
  commercial_invoice: {
    id: "commercial_invoice",
    label: "Commercial Invoice",
    abbreviation: "CI",
    description: "Primary export document listing goods, values, HS codes, and parties",
    issuingAuthority: "Exporter",
    urgency: "critical",
    estimatedDays: 1,
    icon: "📄",
  },
  packing_list: {
    id: "packing_list",
    label: "Packing List",
    abbreviation: "PL",
    description: "Detailed breakdown of packages, weights, and dimensions",
    issuingAuthority: "Exporter",
    urgency: "critical",
    estimatedDays: 1,
    icon: "📦",
  },
  bill_of_lading: {
    id: "bill_of_lading",
    label: "Bill of Lading",
    abbreviation: "B/L",
    description: "Contract of carriage and proof of receipt for goods by carrier",
    issuingAuthority: "Shipping Line / Freight Forwarder",
    urgency: "critical",
    estimatedDays: 3,
    icon: "🚢",
  },
  certificate_of_origin: {
    id: "certificate_of_origin",
    label: "Certificate of Origin",
    abbreviation: "CO",
    description: "Certifies goods originate in Morocco — required by all importers",
    issuingAuthority: "CGEM / Chamber of Commerce (Casablanca)",
    urgency: "critical",
    estimatedDays: 2,
    icon: "🏛️",
  },
  eur1_certificate: {
    id: "eur1_certificate",
    label: "EUR.1 Movement Certificate",
    abbreviation: "EUR.1",
    description: "Grants preferential tariff rates under the Morocco–EU Association Agreement (Agadir)",
    issuingAuthority: "Moroccan Customs — ADII",
    urgency: "critical",
    estimatedDays: 4,
    icon: "🇪🇺",
  },
  csddd_compliance: {
    id: "csddd_compliance",
    label: "CSDDD Compliance Declaration",
    abbreviation: "CSDDD",
    description: "EU Corporate Sustainability Due Diligence Directive — labor, environmental & carbon standards",
    issuingAuthority: "Exporter + Third-party Auditor",
    urgency: "high",
    estimatedDays: 7,
    icon: "🌿",
  },
  onssa_certificate: {
    id: "onssa_certificate",
    label: "ONSSA Food Safety Certificate",
    abbreviation: "ONSSA",
    description: "Moroccan National Office for Food Safety — mandatory for all food/agri exports",
    issuingAuthority: "ONSSA — Office National de Sécurité Sanitaire des Aliments",
    urgency: "critical",
    estimatedDays: 5,
    icon: "🥗",
  },
  phytosanitary_certificate: {
    id: "phytosanitary_certificate",
    label: "Phytosanitary Certificate",
    abbreviation: "PC",
    description: "Certifies plant products are free from pests and diseases",
    issuingAuthority: "ONSSA — Plant Protection Directorate",
    urgency: "high",
    estimatedDays: 3,
    icon: "🌱",
  },
  health_certificate: {
    id: "health_certificate",
    label: "Veterinary / Health Certificate",
    abbreviation: "VC",
    description: "Required for animal products confirming health and safety standards",
    issuingAuthority: "ONSSA — Veterinary Directorate",
    urgency: "critical",
    estimatedDays: 4,
    icon: "🏥",
  },
  cites_permit: {
    id: "cites_permit",
    label: "CITES Export Permit",
    abbreviation: "CITES",
    description: "Convention on International Trade in Endangered Species — required for protected flora/fauna",
    issuingAuthority: "Haut Commissariat aux Eaux et Forêts",
    urgency: "critical",
    estimatedDays: 14,
    icon: "🌿",
  },
  ce_declaration: {
    id: "ce_declaration",
    label: "CE Declaration of Conformity",
    abbreviation: "CE",
    description: "Required for electrical/electronic goods entering the EU single market",
    issuingAuthority: "Notified Body / Manufacturer",
    urgency: "high",
    estimatedDays: 10,
    icon: "⚡",
  },
  halal_certificate: {
    id: "halal_certificate",
    label: "Halal Certification",
    abbreviation: "HC",
    description: "Mandatory for food products exported to GCC / Islamic markets",
    issuingAuthority: "IMANOR / Recognised Halal Body",
    urgency: "critical",
    estimatedDays: 7,
    icon: "☪️",
  },
  fda_prior_notice: {
    id: "fda_prior_notice",
    label: "FDA Prior Notice",
    abbreviation: "FDA",
    description: "US Food & Drug Administration prior notice for food imports into the United States",
    issuingAuthority: "US FDA (submitted by importer)",
    urgency: "high",
    estimatedDays: 2,
    icon: "🇺🇸",
  },
  uk_conformity: {
    id: "uk_conformity",
    label: "UKCA Conformity Declaration",
    abbreviation: "UKCA",
    description: "UK Conformity Assessed mark — replaces CE marking for UK market post-Brexit",
    issuingAuthority: "UK Approved Body",
    urgency: "high",
    estimatedDays: 10,
    icon: "🇬🇧",
  },
};

// ─── Checklist Builder ────────────────────────────────────────────────────────

function getHsChapter(hsCode: string): number {
  return parseInt(hsCode.replace(".", "").substring(0, 2)) || 0;
}

export function buildChecklist(hsCode: string, targetMarket: string): RequiredDocument[] {
  const chapter = getHsChapter(hsCode);
  const docs: RequiredDocument[] = [];

  // ── Base documents — always required ──────────────────────────────────────
  docs.push({ ...DOCS.commercial_invoice, reason: "Required for all international export shipments" });
  docs.push({ ...DOCS.packing_list,       reason: "Required for customs clearance at all ports" });
  docs.push({ ...DOCS.bill_of_lading,     reason: "Issued by carrier — required for all maritime cargo" });
  docs.push({ ...DOCS.certificate_of_origin, reason: "Certifies Moroccan origin — required by all destination customs" });

  // ── EU market ─────────────────────────────────────────────────────────────
  if (targetMarket === "EU") {
    docs.push({
      ...DOCS.eur1_certificate,
      reason: "Morocco–EU Association Agreement: grants 0–reduced tariff preferential rates",
      sectorNote: "Submit via ADII portal at least 5 business days before export",
    });
    docs.push({
      ...DOCS.csddd_compliance,
      reason: "EU CSDDD Directive 2024/1760 — mandatory for EU corporate buyers from 2027 (voluntary best practice now)",
      sectorNote: "Covers supply chain due diligence: labor rights, carbon footprint, environmental impact",
    });
  }

  // ── UK market ─────────────────────────────────────────────────────────────
  if (targetMarket === "UK") {
    docs.push({ ...DOCS.eur1_certificate, reason: "UK-Morocco Association Agreement retains EUR.1 preferential rates" });
  }

  // ── USA market ────────────────────────────────────────────────────────────
  if (targetMarket === "USA" && chapter >= 1 && chapter <= 24) {
    docs.push({ ...DOCS.fda_prior_notice, reason: "FDA Prior Notice required for food/agriculture imports into the US" });
  }

  // ── GCC market ────────────────────────────────────────────────────────────
  if (targetMarket === "GCC" && chapter >= 1 && chapter <= 24) {
    docs.push({ ...DOCS.halal_certificate, reason: "Mandatory for food products entering GCC / Saudi Arabia markets" });
  }

  // ── Food & Beverages (HS chapters 01–24) ─────────────────────────────────
  if (chapter >= 1 && chapter <= 24) {
    docs.push({
      ...DOCS.onssa_certificate,
      reason: "Moroccan law requires ONSSA approval for all food & agriculture exports",
      sectorNote: "Applies to HS chapters 01–24: fresh produce, processed foods, beverages, oils",
    });
  }

  // ── Plant & Vegetable products (HS chapters 06–14) ───────────────────────
  if (chapter >= 6 && chapter <= 14) {
    docs.push({
      ...DOCS.phytosanitary_certificate,
      reason: "International Plant Protection Convention (IPPC) requires phytosanitary certification for plant exports",
    });
  }

  // ── Animal products (HS chapters 01–05, 16) ──────────────────────────────
  if ((chapter >= 1 && chapter <= 5) || chapter === 16) {
    docs.push({
      ...DOCS.health_certificate,
      reason: "Animal products require veterinary health certificate from ONSSA",
    });
  }

  // ── Electronics / Electrical (HS chapters 84–85) for EU ──────────────────
  if ((chapter === 84 || chapter === 85) && (targetMarket === "EU")) {
    docs.push({ ...DOCS.ce_declaration, reason: "CE marking mandatory for electrical/electronic equipment in EU single market" });
  }

  // ── Electronics / Electrical (HS chapters 84–85) for UK ──────────────────
  if ((chapter === 84 || chapter === 85) && targetMarket === "UK") {
    docs.push({ ...DOCS.uk_conformity, reason: "UKCA marking mandatory for electrical goods entering the UK market" });
  }

  // ── Specific CITES-sensitive HS codes (argan, specific species) ───────────
  // Argan (15.15.30) is not CITES-listed, but flag for endangered flora-related codes
  // HS chapter 06 (live plants), 13 (natural resins), specific codes within 44 (wood)
  const hsStr = hsCode.replace(".", "");
  if (["0602", "1301", "4401", "4403"].some((c) => hsStr.startsWith(c))) {
    docs.push({
      ...DOCS.cites_permit,
      reason: "Product may be derived from CITES Appendix-listed flora — permit required",
      sectorNote: "Verify against CITES Appendix I/II/III before export",
    });
  }

  return docs;
}

// ─── Status helpers ────────────────────────────────────────────────────────────

export const DOC_STATUS_META: Record<DocStatus, { label: string; color: string; bg: string; border: string }> = {
  Missing: { label: "Missing",          color: "text-risk-high",    bg: "bg-risk-high/10",   border: "border-risk-high/30" },
  Draft:   { label: "Draft",            color: "text-risk-medium",  bg: "bg-risk-medium/10", border: "border-risk-medium/30" },
  Ready:   { label: "Ready",            color: "text-risk-low",     bg: "bg-risk-low/10",    border: "border-risk-low/30" },
  Filed:   { label: "Filed w/ PortNet", color: "text-primary",      bg: "bg-primary/10",     border: "border-primary/30" },
};

// ─── Document form field definitions ──────────────────────────────────────────

export interface FormField {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea";
  placeholder?: string;
  options?: { value: string; label: string }[];
  autoFillKey?: string; // which URL param to inherit
  section: "exporter" | "consignee" | "shipment" | "goods" | "declaration";
}

export const INCOTERMS = ["FOB", "CIF", "EXW", "DAP", "DDP", "CFR", "FCA", "CPT"].map((v) => ({ value: v, label: v }));
export const CURRENCIES = ["USD", "EUR", "GBP", "MAD", "AED", "SAR"].map((v) => ({ value: v, label: v }));
