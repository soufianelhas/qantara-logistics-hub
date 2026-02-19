// ─────────────────────────────────────────────────────────────────────────────
// Qantara — Mock TARIC / RITA Database
// Simulates Moroccan export tariff classification data
// ─────────────────────────────────────────────────────────────────────────────

export interface TaricEntry {
  hs: string;
  description: string;
  fullDescription: string;
  keywords: string[];
  category: string;
  subcategory: string;
  duty: number;   // EU import duty rate %
  tax: number;    // Moroccan TVA/export tax %
  eRisk: "low" | "medium" | "high";
  portOfOrigin: string[];
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: string;
  label: string;
}

// ─── Categories & Sub-categories ─────────────────────────────────────────────

export const CATEGORIES: Category[] = [
  {
    id: "agri",
    label: "Agricultural & Food Products",
    icon: "🌿",
    subcategories: [
      { id: "oils",    label: "Oils & Fats" },
      { id: "spices",  label: "Spices & Herbs" },
      { id: "fruits",  label: "Fruits & Vegetables" },
      { id: "cereals", label: "Cereals & Grains" },
      { id: "agri_other", label: "Other Agricultural" },
    ],
  },
  {
    id: "textile",
    label: "Textiles & Clothing",
    icon: "🧵",
    subcategories: [
      { id: "carpets",  label: "Carpets & Rugs" },
      { id: "garments", label: "Garments & Apparel" },
      { id: "fabrics",  label: "Fabrics & Yarn" },
    ],
  },
  {
    id: "mineral",
    label: "Minerals & Chemicals",
    icon: "⛏️",
    subcategories: [
      { id: "phosphates", label: "Phosphates & Derivatives" },
      { id: "chemicals",  label: "Industrial Chemicals" },
      { id: "metals",     label: "Metals & Ores" },
    ],
  },
  {
    id: "marine",
    label: "Marine & Fishery Products",
    icon: "🐟",
    subcategories: [
      { id: "fresh",     label: "Fresh & Frozen Fish" },
      { id: "processed", label: "Canned & Processed" },
      { id: "shellfish", label: "Shellfish & Crustaceans" },
    ],
  },
  {
    id: "mfg",
    label: "Manufactured & Craft Goods",
    icon: "🏭",
    subcategories: [
      { id: "automotive",  label: "Automotive Components" },
      { id: "electronics", label: "Electronics & Cables" },
      { id: "crafts",      label: "Artisan & Craft Products" },
    ],
  },
];

// ─── TARIC Entries ────────────────────────────────────────────────────────────

export const TARIC_DATABASE: TaricEntry[] = [
  // ── Agricultural / Oils ──────────────────────────────────────────────────
  {
    hs: "1515.30",
    description: "Argan Oil — Cosmetic & Edible Grade",
    fullDescription: "Fixed vegetable fats and oils of Argania spinosa, crude or refined",
    keywords: ["argan", "argan oil", "oil", "cosmetic", "beauty", "edible"],
    category: "agri", subcategory: "oils",
    duty: 7.5, tax: 20, eRisk: "low",
    portOfOrigin: ["Agadir", "Casablanca"],
  },
  {
    hs: "1509.10",
    description: "Extra Virgin Olive Oil",
    fullDescription: "Olive oil and its fractions — virgin grade, not chemically modified",
    keywords: ["olive", "olive oil", "virgin", "huile", "hdida"],
    category: "agri", subcategory: "oils",
    duty: 0, tax: 20, eRisk: "low",
    portOfOrigin: ["Casablanca", "Tanger Med"],
  },
  {
    hs: "1515.50",
    description: "Sesame Oil (Crude or Refined)",
    fullDescription: "Sesame oil and its fractions, crude or refined, not chemically modified",
    keywords: ["sesame", "sesame oil", "graines de sésame"],
    category: "agri", subcategory: "oils",
    duty: 5, tax: 20, eRisk: "low",
    portOfOrigin: ["Agadir", "Casablanca"],
  },

  // ── Agricultural / Spices ─────────────────────────────────────────────────
  {
    hs: "0910.99",
    description: "Mixed Spices & Blends (incl. Ras el Hanout)",
    fullDescription: "Mixtures of spices — ginger, saffron, turmeric, thyme, bay leaves and others",
    keywords: ["spice", "spices", "ras el hanout", "mixed spice", "blend", "épices"],
    category: "agri", subcategory: "spices",
    duty: 12.5, tax: 20, eRisk: "medium",
    portOfOrigin: ["Casablanca", "Agadir"],
  },
  {
    hs: "0909.21",
    description: "Cumin Seeds (Crushed or Ground)",
    fullDescription: "Seeds of coriander, anise, badian, caraway or fennel; juniper berries",
    keywords: ["cumin", "cumin seeds", "ground cumin", "seed"],
    category: "agri", subcategory: "spices",
    duty: 5, tax: 20, eRisk: "low",
    portOfOrigin: ["Casablanca"],
  },
  {
    hs: "0910.20",
    description: "Saffron — Premium Grade (Taliouine)",
    fullDescription: "Saffron, dried stigmas of Crocus sativus, whole or ground",
    keywords: ["saffron", "safran", "taliouine", "crocus"],
    category: "agri", subcategory: "spices",
    duty: 15, tax: 20, eRisk: "medium",
    portOfOrigin: ["Agadir", "Casablanca"],
  },

  // ── Agricultural / Fruits & Vegetables ───────────────────────────────────
  {
    hs: "0805.10",
    description: "Oranges — Fresh or Dried",
    fullDescription: "Citrus fruit, fresh or dried — oranges",
    keywords: ["orange", "citrus", "clementine", "agrumes"],
    category: "agri", subcategory: "fruits",
    duty: 16, tax: 20, eRisk: "high",
    portOfOrigin: ["Agadir", "Casablanca"],
  },
  {
    hs: "0702.00",
    description: "Tomatoes — Fresh or Chilled",
    fullDescription: "Tomatoes, fresh or chilled",
    keywords: ["tomato", "tomatoes", "tomate", "fresh vegetable"],
    category: "agri", subcategory: "fruits",
    duty: 14.4, tax: 20, eRisk: "high",
    portOfOrigin: ["Agadir", "Kenitra"],
  },
  {
    hs: "0804.10",
    description: "Dates — Fresh, Dried, Medjool",
    fullDescription: "Dates, figs, pineapples, avocados, guavas, mangoes and mangosteens — dates",
    keywords: ["date", "dates", "medjool", "palm", "dattes"],
    category: "agri", subcategory: "fruits",
    duty: 3.2, tax: 20, eRisk: "low",
    portOfOrigin: ["Agadir", "Casablanca"],
  },

  // ── Textiles / Carpets ────────────────────────────────────────────────────
  {
    hs: "5701.10",
    description: "Berber Wool Knotted Carpets",
    fullDescription: "Carpets and other textile floor coverings, knotted — of wool or fine animal hair",
    keywords: ["carpet", "rug", "berber", "wool", "knotted", "handmade", "tapis"],
    category: "textile", subcategory: "carpets",
    duty: 8, tax: 20, eRisk: "low",
    portOfOrigin: ["Casablanca", "Tanger Med"],
  },
  {
    hs: "5702.31",
    description: "Machine-Made Woven Carpets (Wool)",
    fullDescription: "Carpets and other textile floor coverings, woven — of wool or fine animal hair",
    keywords: ["machine carpet", "woven carpet", "wool rug", "industrial carpet"],
    category: "textile", subcategory: "carpets",
    duty: 12, tax: 20, eRisk: "low",
    portOfOrigin: ["Casablanca"],
  },

  // ── Textiles / Garments ───────────────────────────────────────────────────
  {
    hs: "6203.42",
    description: "Men's Trousers & Breeches (Cotton)",
    fullDescription: "Men's or boys' suits, ensembles, jackets, trousers — of cotton",
    keywords: ["trouser", "pants", "jeans", "men's clothing", "cotton trousers"],
    category: "textile", subcategory: "garments",
    duty: 12, tax: 20, eRisk: "medium",
    portOfOrigin: ["Tanger Med", "Casablanca"],
  },
  {
    hs: "6204.42",
    description: "Women's Dresses & Suits (Cotton)",
    fullDescription: "Women's or girls' suits, ensembles, jackets, dresses — of cotton",
    keywords: ["dress", "women's clothing", "caftan", "djellaba", "textile export"],
    category: "textile", subcategory: "garments",
    duty: 12, tax: 20, eRisk: "medium",
    portOfOrigin: ["Tanger Med", "Casablanca"],
  },

  // ── Minerals / Phosphates ─────────────────────────────────────────────────
  {
    hs: "2510.10",
    description: "Natural Calcium Phosphates (Phosphate Rock)",
    fullDescription: "Natural calcium phosphates, aluminium calcium phosphates — unground",
    keywords: ["phosphate", "phosphate rock", "ocp", "mineral", "fertilizer raw"],
    category: "mineral", subcategory: "phosphates",
    duty: 0, tax: 20, eRisk: "low",
    portOfOrigin: ["Casablanca", "Jorf Lasfar"],
  },
  {
    hs: "2809.20",
    description: "Phosphoric Acid (Industrial Grade)",
    fullDescription: "Diphosphorus pentaoxide; phosphoric acid; polyphosphoric acids",
    keywords: ["phosphoric acid", "acid", "chemical", "fertilizer", "phosphate processing"],
    category: "mineral", subcategory: "phosphates",
    duty: 0, tax: 20, eRisk: "medium",
    portOfOrigin: ["Jorf Lasfar", "Casablanca"],
  },
  {
    hs: "3104.20",
    description: "Potassium Chloride (Potash Fertilizer)",
    fullDescription: "Potassium chloride for use as fertilizers",
    keywords: ["potassium", "potash", "chloride", "fertilizer", "chemical"],
    category: "mineral", subcategory: "chemicals",
    duty: 0, tax: 20, eRisk: "low",
    portOfOrigin: ["Casablanca"],
  },

  // ── Marine / Processed ────────────────────────────────────────────────────
  {
    hs: "1604.13",
    description: "Canned Sardines in Olive Oil",
    fullDescription: "Prepared or preserved fish — sardines, sardinella, brisling or sprats",
    keywords: ["sardine", "canned fish", "preserved fish", "olive oil fish", "conserve"],
    category: "marine", subcategory: "processed",
    duty: 15, tax: 20, eRisk: "medium",
    portOfOrigin: ["Agadir", "Safi", "Laayoune"],
  },
  {
    hs: "0307.43",
    description: "Frozen Octopus (Cleaned, Whole)",
    fullDescription: "Molluscs — octopus, frozen, excluding in shell",
    keywords: ["octopus", "poulpe", "frozen", "seafood", "cephalopod"],
    category: "marine", subcategory: "shellfish",
    duty: 10, tax: 20, eRisk: "high",
    portOfOrigin: ["Agadir", "Dakhla", "Laayoune"],
  },
  {
    hs: "0303.89",
    description: "Frozen Atlantic Fish (Other species)",
    fullDescription: "Fish, frozen — other fish, excluding fish fillets and other fish meat",
    keywords: ["fish", "frozen fish", "atlantic", "hake", "sea bream", "poisson"],
    category: "marine", subcategory: "fresh",
    duty: 8, tax: 20, eRisk: "medium",
    portOfOrigin: ["Agadir", "Dakhla"],
  },

  // ── Manufactured / Automotive ─────────────────────────────────────────────
  {
    hs: "8544.30",
    description: "Automotive Wiring Harnesses",
    fullDescription: "Ignition wiring sets and other wiring sets used in vehicles, aircraft or ships",
    keywords: ["wire harness", "wiring", "automotive", "cable set", "vehicle wiring", "renault", "stellantis"],
    category: "mfg", subcategory: "automotive",
    duty: 3.5, tax: 20, eRisk: "low",
    portOfOrigin: ["Tanger Med", "Casablanca"],
  },
  {
    hs: "8544.42",
    description: "Electric Conductors & Power Cables",
    fullDescription: "Electric conductors for a voltage ≤ 1,000 V — fitted with connectors",
    keywords: ["cable", "electric", "conductor", "power cable", "wire"],
    category: "mfg", subcategory: "electronics",
    duty: 3.5, tax: 20, eRisk: "low",
    portOfOrigin: ["Tanger Med", "Casablanca"],
  },
  {
    hs: "6913.10",
    description: "Artisan Pottery & Terracotta (Decorative)",
    fullDescription: "Statuettes and other ornamental ceramic articles — of porcelain or china",
    keywords: ["pottery", "ceramic", "terracotta", "zellige", "artisan", "craft", "decorative"],
    category: "mfg", subcategory: "crafts",
    duty: 4.7, tax: 20, eRisk: "low",
    portOfOrigin: ["Casablanca", "Tanger Med"],
  },
  {
    hs: "4602.19",
    description: "Wickerwork & Basketry (Esparto/Reed)",
    fullDescription: "Basketwork, wickerwork and other articles of plaiting materials — of other vegetable materials",
    keywords: ["basket", "wickerwork", "esparto", "artisan", "reed", "handcraft", "vannerie"],
    category: "mfg", subcategory: "crafts",
    duty: 3.7, tax: 20, eRisk: "low",
    portOfOrigin: ["Casablanca", "Agadir"],
  },
];

// ─── Scoring Logic ────────────────────────────────────────────────────────────

export function scoreEntry(
  entry: TaricEntry,
  category: string,
  subcategory: string,
  description: string
): number {
  let score = 0;

  // Category match
  if (entry.category === category) score += 40;

  // Sub-category match
  if (entry.subcategory === subcategory) score += 30;

  // Keyword match (description text)
  const desc = description.toLowerCase();
  const matchedKeywords = entry.keywords.filter((kw) => desc.includes(kw.toLowerCase()));
  score += matchedKeywords.length * 8;

  return Math.min(score, 99); // cap at 99 for realism
}

export function getTopMatches(
  category: string,
  subcategory: string,
  description: string,
  limit = 4
): Array<{ entry: TaricEntry; confidence: number }> {
  const scored = TARIC_DATABASE.map((entry) => ({
    entry,
    confidence: scoreEntry(entry, category, subcategory, description),
  }));

  return scored
    .filter((r) => r.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit)
    .map((r) => ({
      ...r,
      // Add small random noise (±3%) to simulate AI uncertainty
      confidence: Math.max(45, Math.min(99, r.confidence + Math.floor(Math.random() * 7) - 3)),
    }));
}
