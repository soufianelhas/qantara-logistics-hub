import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldCheck, Upload, Download, AlertTriangle, Sun, Layers, Sparkles,
  RefreshCw, ChevronLeft, ChevronRight, Camera, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const E_FACTOR_RISK_THRESHOLD = 1.15;

const PRESETS = [
  {
    id: "muted-moroccan-sunlight",
    name: "Muted Moroccan Sunlight",
    market: "EU",
    icon: Sun,
    description: "Warm, desaturated golden-hour lighting — artisanal & authentic",
    badge: "EU Market",
    badgeClass: "border-blue-400/40 text-blue-600 bg-blue-50",
  },
  {
    id: "industrial-texture",
    name: "Industrial Texture",
    market: "US/Modern",
    icon: Layers,
    description: "Micro-contrast on raw materials — gallery-quality cool lighting",
    badge: "US/Modern",
    badgeClass: "border-slate-400/40 text-slate-600 bg-slate-50",
  },
  {
    id: "clean-white-background",
    name: "Clean White Background",
    market: "E-commerce",
    icon: Sparkles,
    description: "Studio-perfect #FFFFFF white — e-commerce ready",
    badge: "E-commerce",
    badgeClass: "border-emerald-400/40 text-emerald-600 bg-emerald-50",
  },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

// ─── Before/After Slider ──────────────────────────────────────────────────────

function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
}: {
  beforeSrc: string;
  afterSrc: string | null;
}) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updateSlider = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSlider(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    updateSlider(e.clientX);
  };
  const onPointerUp = () => { isDragging.current = false; };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden rounded-xl cursor-col-resize"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Before (full width) */}
      <img
        src={beforeSrc}
        alt="Before"
        className="absolute inset-0 w-full h-full object-contain bg-muted/30"
        draggable={false}
      />

      {/* After (clipped) */}
      {afterSrc && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <img
            src={afterSrc}
            alt="After"
            className="absolute inset-0 w-full h-full object-contain bg-muted/10"
            style={{ width: `${containerRef.current?.offsetWidth ?? 400}px`, maxWidth: "unset" }}
            draggable={false}
          />
        </div>
      )}

      {/* Divider */}
      {afterSrc && (
        <div
          className="absolute inset-y-0 w-0.5 bg-white shadow-lg"
          style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
        >
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-elevated flex items-center justify-center border border-border">
            <ChevronLeft className="w-3 h-3 text-foreground" />
            <ChevronRight className="w-3 h-3 text-foreground" />
          </div>
        </div>
      )}

      {/* Labels */}
      <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/50 text-white text-[10px] font-semibold uppercase tracking-wide">
        Before
      </div>
      {afterSrc && (
        <div
          className="absolute top-3 right-3 px-2 py-1 rounded bg-primary/80 text-primary-foreground text-[10px] font-semibold uppercase tracking-wide"
        >
          After
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AuthenticityStudio() {
  const { toast } = useToast();

  // E-Factor risk flag (read from localStorage)
  const [eFactorValue, setEFactorValue] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("qantara_efactor");
    if (stored) {
      const val = parseFloat(stored);
      if (!isNaN(val)) setEFactorValue(val);
    }
  }, []);

  const isHighRisk = eFactorValue !== null && eFactorValue > E_FACTOR_RISK_THRESHOLD;

  // Image state
  const [originalImage, setOriginalImage]   = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage]   = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(null);
  const [isEnhancing,    setIsEnhancing]    = useState(false);
  const [fileName,       setFileName]       = useState("enhanced-image");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name.replace(/\.[^.]+$/, ""));
    const reader = new FileReader();
    reader.onload = (ev) => {
      setOriginalImage(ev.target?.result as string);
      setEnhancedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleEnhance = async () => {
    if (!originalImage || !selectedPreset) return;
    setIsEnhancing(true);
    setEnhancedImage(null);

    try {
      const { data, error } = await supabase.functions.invoke("image-enhance", {
        body: { imageBase64: originalImage, preset: selectedPreset },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Enhancement failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      if (data?.enhancedImageBase64) {
        setEnhancedImage(data.enhancedImageBase64);
        toast({ title: "Image enhanced!", description: "Your product image is ready for export." });
      } else {
        throw new Error("No image returned from AI model");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Enhancement failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleDownload = () => {
    if (!enhancedImage) return;
    const a = document.createElement("a");
    a.href = enhancedImage;
    a.download = `${fileName}-enhanced.png`;
    a.click();
  };

  const canEnhance = !!originalImage && !!selectedPreset && !isEnhancing;

  return (
    <AppLayout title="Authenticity Studio" subtitle="AI Image Refinement — Export-Ready Product Photography">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── E-Factor Risk Flag ─────────────────────────────────────────── */}
        {isHighRisk && (
          <Alert className="border-warning/50 bg-warning/10 animate-fade-in">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning font-semibold text-sm">Logistics Risk High</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground mt-1">
              High winds/congestion at Tanger Med (E-Factor ×{eFactorValue?.toFixed(4)}).{" "}
              <strong className="text-foreground">Suggest pausing marketing promotion</strong> until conditions normalise.
            </AlertDescription>
          </Alert>
        )}

        {/* ── Main layout ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* LEFT — Before/After Preview (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-primary" />
                Image Studio
              </h2>
              {enhancedImage && (
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  size="sm"
                  className="text-xs border-primary/30 text-primary hover:bg-primary/5 gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Enhanced
                </Button>
              )}
            </div>

            {/* Preview area */}
            <div
              className="relative rounded-xl border border-border bg-card overflow-hidden"
              style={{ minHeight: "420px" }}
            >
              {!originalImage ? (
                <label className="absolute inset-0 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-primary/4 transition-colors group">
                  <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/20 flex items-center justify-center group-hover:bg-primary/12 transition-colors">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Upload Product Image</p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP — drag & drop or click</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              ) : (
                <BeforeAfterSlider beforeSrc={originalImage} afterSrc={enhancedImage} />
              )}

              {/* Loading overlay */}
              {isEnhancing && (
                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Gemini is enhancing your image…</p>
                  <p className="text-xs text-muted-foreground">This may take 10–30 seconds</p>
                </div>
              )}
            </div>

            {/* Re-upload */}
            {originalImage && (
              <button
                onClick={() => { setOriginalImage(null); setEnhancedImage(null); fileInputRef.current?.click(); }}
                className="text-xs text-muted-foreground hover:text-primary transition-colors text-center"
              >
                ↺ Upload a different image
              </button>
            )}
          </div>

          {/* RIGHT — Controls (2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* Preset grid */}
            <div>
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <Star className="w-3.5 h-3.5 text-primary" />
                Consultant Presets
              </h2>
              <div className="space-y-2.5">
                {PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedPreset(preset.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all duration-150",
                        isSelected
                          ? "border-primary bg-primary/8 shadow-sm"
                          : "border-border bg-card hover:border-primary/30 hover:bg-primary/4"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
                          isSelected ? "bg-primary/15 border-primary/30" : "bg-muted border-border"
                        )}>
                          <Icon className={cn("w-4 h-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={cn("text-xs font-semibold", isSelected ? "text-primary" : "text-foreground")}>
                              {preset.name}
                            </span>
                            <Badge variant="outline" className={cn("text-[9px]", preset.badgeClass)}>
                              {preset.badge}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {preset.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action area */}
            <div className="space-y-3">
              {/* Upload button (when no image yet) */}
              {!originalImage && (
                <Button
                  variant="outline"
                  className="w-full border-primary/30 text-primary hover:bg-primary/5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  Upload Image
                </Button>
              )}

              {/* Enhance button */}
              <Button
                onClick={handleEnhance}
                disabled={!canEnhance}
                className={cn(
                  "w-full text-sm font-semibold h-11 transition-all",
                  canEnhance
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {isEnhancing ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Enhancing…</>
                ) : (
                  <><ShieldCheck className="w-4 h-4" /> Enhance with AI</>
                )}
              </Button>

              {/* Status hints */}
              {!originalImage && !selectedPreset && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Upload an image and select a preset to begin
                </p>
              )}
              {originalImage && !selectedPreset && (
                <p className="text-[11px] text-warning font-medium text-center">
                  ↑ Select a preset above to enable enhancement
                </p>
              )}
              {!originalImage && selectedPreset && (
                <p className="text-[11px] text-warning font-medium text-center">
                  ↑ Upload an image to enable enhancement
                </p>
              )}
              {enhancedImage && (
                <div className="rounded-lg border border-risk-low/30 bg-risk-low/8 px-3 py-2.5 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-risk-low shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Enhancement complete</p>
                    <p className="text-[11px] text-muted-foreground">Drag the slider to compare Before / After</p>
                  </div>
                </div>
              )}
            </div>

            {/* Info panel */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">About This Studio</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Powered by <strong className="text-foreground">Gemini 2.5 Flash Image</strong>. Your product image is sent to the AI model with the selected consultant prompt. 
                The enhanced image is returned and displayed in the After panel — ready for export-grade marketing.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-risk-low" />
                Images are processed securely and not stored
              </div>
              {eFactorValue !== null && (
                <div className={cn(
                  "flex items-center gap-2 text-[11px] font-medium",
                  isHighRisk ? "text-warning" : "text-risk-low"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", isHighRisk ? "bg-warning" : "bg-risk-low")} />
                  Current E-Factor: ×{eFactorValue.toFixed(4)} {isHighRisk ? "— High logistics risk" : "— Normal conditions"}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
