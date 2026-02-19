import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  ChevronRight,
  ChevronLeft,
  Search,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Star,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  type TaricEntry,
  getTopMatches,
} from "@/data/taric-database";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Stage machine ────────────────────────────────────────────────────────────

type Stage = "category" | "subcategory" | "details" | "results";

interface MatchResult {
  entry: TaricEntry;
  confidence: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const E_RISK_BADGE = {
  low:    { label: "Low Risk",    cls: "bg-risk-low/15 text-risk-low border-risk-low/30" },
  medium: { label: "Medium Risk", cls: "bg-risk-medium/15 text-risk-medium border-risk-medium/30" },
  high:   { label: "High Risk",   cls: "bg-risk-high/15 text-risk-high border-risk-high/30" },
};

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-risk-low" : value >= 55 ? "bg-risk-medium" : "bg-risk-high";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-mono font-semibold text-foreground w-8 text-right">
        {value}%
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HSNeuralNavigator() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Stage state
  const [stage, setStage] = useState<Stage>("category");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [productDescription, setProductDescription] = useState<string>("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);

  // Persistent shipment state
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);

  // ── Navigation helpers ──────────────────────────────────────────────────

  const currentCategory = CATEGORIES.find((c) => c.id === selectedCategory);

  const handleCategorySelect = (id: string) => {
    setSelectedCategory(id);
    setSelectedSubcategory("");
    setStage("subcategory");
  };

  const handleSubcategorySelect = (id: string) => {
    setSelectedSubcategory(id);
    setStage("details");
  };

  // Create a draft shipment in Supabase (authenticated only)
  const createDraftShipment = async (productName: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("shipments")
        .insert({
          user_id: user.id,
          product_name: productName || "Unclassified Product",
          status: "Draft",
          raw_cost_v: 0,
          freight: 0,
          insurance: 0,
          duty: 0,
          taxes: 0,
          e_factor_multiplier: 1.0,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data?.id ?? null;
    } catch (err) {
      console.warn("Could not create draft shipment (guest mode):", err);
      return null;
    }
  };

  const handleClassify = async () => {
    setIsClassifying(true);
    setResults([]);
    setSelectedResult(null);

    // Create draft shipment if not already created
    if (!shipmentId && !isCreatingShipment) {
      setIsCreatingShipment(true);
      const id = await createDraftShipment(productDescription.slice(0, 60));
      if (id) {
        setShipmentId(id);
        toast({ title: "Session started", description: "Draft shipment created — your progress is saved." });
      }
      setIsCreatingShipment(false);
    }

    // Simulate async classification (400-900ms)
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    const matches = getTopMatches(selectedCategory, selectedSubcategory, productDescription);
    setResults(matches);
    setIsClassifying(false);
    setStage("results");
  };

  const handleExportToLCE = async () => {
    if (!selectedResult) return;

    let activeShipmentId = shipmentId;

    // Update the draft shipment with the selected HS code
    if (activeShipmentId) {
      try {
        await supabase
          .from("shipments")
          .update({
            hs_code_assigned: selectedResult.entry.hs,
            product_name: selectedResult.entry.description,
          })
          .eq("id", activeShipmentId);
      } catch (err) {
        console.warn("Could not update shipment with HS code:", err);
      }
    } else {
      // Try creating one now if still not created
      activeShipmentId = await createDraftShipment(selectedResult.entry.description);
      if (activeShipmentId) {
        setShipmentId(activeShipmentId);
        await supabase
          .from("shipments")
          .update({ hs_code_assigned: selectedResult.entry.hs })
          .eq("id", activeShipmentId);
      }
    }

    const params = new URLSearchParams({
      hs_code:      selectedResult.entry.hs,
      duty:         String(selectedResult.entry.duty),
      tax:          String(selectedResult.entry.tax),
      product_name: selectedResult.entry.description,
      confidence:   String(selectedResult.confidence),
      from:         "classifier",
    });

    if (activeShipmentId) {
      params.set("shipment_id", activeShipmentId);
    }

    navigate(`/landed-cost?${params.toString()}`);
  };

  const handleReset = () => {
    setStage("category");
    setSelectedCategory("");
    setSelectedSubcategory("");
    setProductDescription("");
    setResults([]);
    setSelectedResult(null);
    setShipmentId(null);
  };

  // ── Stage: Category ─────────────────────────────────────────────────────

  const renderCategory = () => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Step 1 of 3 — Product Category
        </h2>
        <p className="text-xs text-muted-foreground">
          What best describes the product you are classifying for export?
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategorySelect(cat.id)}
            className={cn(
              "group text-left p-4 rounded-xl border transition-all duration-150",
              "hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm",
              "border-border bg-card"
            )}
          >
            <div className="text-2xl mb-2">{cat.icon}</div>
            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {cat.label}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {cat.subcategories.length} sub-categories
            </p>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Stage: Subcategory ──────────────────────────────────────────────────

  const renderSubcategory = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setStage("category")}
          className="w-7 h-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-lg">{currentCategory?.icon}</span>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
              {currentCategory?.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Step 2 of 3 — Select a sub-category
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {currentCategory?.subcategories.map((sub) => (
          <button
            key={sub.id}
            onClick={() => handleSubcategorySelect(sub.id)}
            className={cn(
              "group flex items-center justify-between p-4 rounded-xl border transition-all duration-150",
              "hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm",
              "border-border bg-card text-left"
            )}
          >
            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {sub.label}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );

  // ── Stage: Product Details ──────────────────────────────────────────────

  const currentSubcat = currentCategory?.subcategories.find(
    (s) => s.id === selectedSubcategory
  );

  const renderDetails = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setStage("subcategory")}
          className="w-7 h-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
            {currentCategory?.label}
          </Badge>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            {currentSubcat?.label}
          </Badge>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">
            Step 3 of 3 — Interrogator
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Describe your product in plain language. Include material, processing level, end use, 
            and any local names. The Interrogator cross-references RITA and TARIC databases for 
            the most accurate classification.
          </p>
        </div>

        <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 flex items-start gap-2">
          <Brain className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Interrogator tip:</strong> Mention origin, packaging, 
            and whether the product is raw, semi-processed, or fully processed. 
            E.g. <em>"Cold-pressed argan oil for cosmetic use, bottled 100ml, certified organic."</em>
          </p>
        </div>

        <Textarea
          placeholder="Describe your export product here…"
          className="resize-none h-32 text-sm bg-background"
          value={productDescription}
          onChange={(e) => setProductDescription(e.target.value)}
        />

        <Button
          onClick={handleClassify}
          disabled={productDescription.trim().length < 5 || isClassifying}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isClassifying ? (
            <>
              <Brain className="w-4 h-4 animate-pulse" />
              Querying RITA / TARIC databases…
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Classify Product
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // ── Stage: Results ──────────────────────────────────────────────────────

  const renderResults = () => (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Classification Results</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {results.length} matches found — select the best HS code to proceed
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New Classification
        </Button>
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {results.map((r, idx) => {
          const isSelected = selectedResult?.entry.hs === r.entry.hs;
          const isBestMatch = idx === 0;
          const eInfo = E_RISK_BADGE[r.entry.eRisk];

          return (
            <button
              key={r.entry.hs}
              onClick={() => setSelectedResult(isSelected ? null : r)}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary/8 shadow-sm"
                  : "border-border bg-card hover:border-primary/30 hover:bg-primary/4"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Selector */}
                <div
                  className={cn(
                    "mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-border"
                  )}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-mono text-sm font-bold text-foreground">
                      {r.entry.hs}
                    </span>
                    {isBestMatch && (
                      <Badge className="text-[10px] bg-primary/10 text-primary border-primary/25 gap-1">
                        <Star className="w-2.5 h-2.5" />
                        Best Match
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", eInfo.cls)}
                    >
                      E-Factor: {eInfo.label}
                    </Badge>
                  </div>

                  <p className="text-sm font-medium text-foreground truncate">
                    {r.entry.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {r.entry.fullDescription}
                  </p>

                  {/* Confidence + Rates */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-20 shrink-0">
                        Match score
                      </span>
                      <ConfidenceBar value={r.confidence} />
                    </div>
                    <div className="flex items-center gap-4 pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">D — Duty</span>
                        <span className="font-mono text-xs font-bold text-foreground">{r.entry.duty}%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">T — Tax</span>
                        <span className="font-mono text-xs font-bold text-foreground">{r.entry.tax}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-[10px] text-muted-foreground">Port:</span>
                        <span className="text-[10px] text-foreground">{r.entry.portOfOrigin[0]}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Export CTA */}
      {selectedResult && (
        <div className="animate-fade-in rounded-xl border border-primary/25 bg-primary/8 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              HS Code <span className="font-mono text-primary">{selectedResult.entry.hs}</span> selected
            </p>
            {shipmentId && (
              <Badge variant="outline" className="ml-auto text-[10px] border-risk-low/40 text-risk-low">
                ✓ Session saved
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-primary" />
              Duty rate <strong className="text-foreground">{selectedResult.entry.duty}%</strong> will be auto-filled
            </span>
            <span className="text-border">·</span>
            <span>
              Tax rate <strong className="text-foreground">{selectedResult.entry.tax}%</strong> will be auto-filled
            </span>
          </div>
          <Button
            onClick={handleExportToLCE}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            size="lg"
          >
            Apply Code & Calculate Costs
            <ArrowRight className="w-4 h-4" />
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            You'll be taken to the Landed Cost Engine with D and T pre-populated
          </p>
        </div>
      )}

      {/* No matches fallback */}
      {results.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-risk-medium mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No matches found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try rephrasing your product description or selecting a different category.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={handleReset}>
            Start Over
          </Button>
        </div>
      )}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <AppLayout
      title="HS Neural-Navigator"
      subtitle="Interrogator — TARIC / RITA classification engine"
    >
      <div className="max-w-3xl mx-auto">
        <WorkflowStepper currentStep={1} />

        {stage === "category"    && renderCategory()}
        {stage === "subcategory" && renderSubcategory()}
        {stage === "details"     && renderDetails()}
        {stage === "results"     && renderResults()}
      </div>
    </AppLayout>
  );
}
