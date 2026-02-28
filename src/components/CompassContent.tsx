import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useShipmentRecovery } from "@/hooks/use-shipment-recovery";
import {
    Globe, BarChart3, TrendingUp, Search, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Brain, Lock, DollarSign,
    Save
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Market {
    countryCode: string;
    countryName: string;
    annualImportValue: string;
    averageRetailPrice: number;
    demandScore: number;
    logisticsOverheadEstimate: number;
}

interface CompassContentProps {
    onPushToCalculator?: () => void;
    isOverlay?: boolean;
}

export function CompassContent({ onPushToCalculator, isOverlay = false }: CompassContentProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const calculatorRef = useRef<HTMLDivElement>(null);

    const paramHsCode = searchParams.get("hs_code") || "";
    const paramProduct = searchParams.get("product_name") || "";
    const paramShipmentId = searchParams.get("shipment_id") || null;
    const fromClassifier = searchParams.get("from") === "classifier";

    // Shipment Recovery state
    const { shipmentId: recoveredId, shipment: recoveredShipment, recovered } = useShipmentRecovery(paramShipmentId, ["Draft"]);
    const [activeShipmentId, setActiveShipmentId] = useState<string | null>(paramShipmentId);

    useEffect(() => {
        if (recoveredId && !activeShipmentId) setActiveShipmentId(recoveredId);
    }, [recoveredId]);

    // UI State
    const [productName, setProductName] = useState(() => paramProduct || localStorage.getItem("qantara_co_productName") || "");
    const [hsCode, setHsCode] = useState(() => paramHsCode || localStorage.getItem("qantara_co_hsCode") || "");

    // Intelligence State
    const [loadingMarkets, setLoadingMarkets] = useState(false);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

    // Benchmarking State
    const [shelfPrice, setShelfPrice] = useState("100");
    const [marginPct, setMarginPct] = useState("30");

    const calculatorUnlocked = selectedMarket !== null;

    // Sync inputs
    useEffect(() => {
        if (paramHsCode) setHsCode(paramHsCode);
        if (paramProduct) setProductName(paramProduct);
    }, [paramHsCode, paramProduct]);

    useEffect(() => {
        localStorage.setItem("qantara_co_productName", productName);
        localStorage.setItem("qantara_co_hsCode", hsCode);
    }, [productName, hsCode]);

    useEffect(() => {
        if (recovered && recoveredShipment && !fromClassifier) {
            if (recoveredShipment.hs_code_assigned && !hsCode) setHsCode(recoveredShipment.hs_code_assigned);
            if (recoveredShipment.product_name && !productName) setProductName(recoveredShipment.product_name);
        }
    }, [recovered, recoveredShipment, fromClassifier]);

    const handleFetchIntelligence = async () => {
        if (!hsCode || !productName) {
            toast({ title: "Missing Information", description: "Provide Product Name and HS Code first.", variant: "destructive" });
            return;
        }

        setLoadingMarkets(true);
        setMarkets([]);
        setSelectedMarket(null);

        try {
            // Standard fetch bypasses the internal Supabase client's auth enforcement mechanisms
            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-market-intelligence`;
            const response = await fetch(functionUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // Empty auth to prevent Edge Runtime ES256 crash
                    "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
                },
                body: JSON.stringify({ hs_code: hsCode, product_name: productName, shipment_id: activeShipmentId })
            });

            if (!response.ok) {
                console.error('Edge Function HTTP Error:', response.statusText);
                throw new Error(`Edge Function Failed: ${response.statusText}`);
            }

            const data = await response.json();

            if (data?.error) throw new Error(data.error);

            if (data?.markets && Array.isArray(data.markets)) {
                setMarkets(data.markets);
                toast({ title: "Market Intelligence Pulled", description: `Found ${data.markets.length} top target markets.` });

                // Save to background market_intelligence table
                saveMarketIntelligenceToDb(data.markets, null);
            }
        } catch (err: unknown) {
            toast({ title: "Intelligence Fetch Failed", description: err instanceof Error ? err.message : "Service unavailable.", variant: "destructive" });
        } finally {
            setLoadingMarkets(false);
        }
    };

    const saveMarketIntelligenceToDb = async (marketData: any, advice: string | null) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let targetShipmentId = activeShipmentId;

            // Create a new Draft shipment if running standalone without context
            if (!targetShipmentId) {
                const { data: newShipment, error: createError } = await supabase
                    .from("shipments")
                    .insert({
                        user_id: user.id,
                        status: "Draft",
                        product_name: productName,
                        hs_code_assigned: hsCode,
                    })
                    .select("id")
                    .single();

                if (createError) throw createError;
                if (newShipment) {
                    targetShipmentId = newShipment.id;
                    setActiveShipmentId(newShipment.id);

                    // Update URL for standalone persistence
                    if (!isOverlay) {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set("shipment_id", newShipment.id);
                        setSearchParams(newParams);
                    }
                }
            }

            if (!targetShipmentId) return;

            const payload = {
                shipment_id: targetShipmentId,
                user_id: user.id,
                opportunity_data: marketData,
                strategic_advice: advice,
            };

            await supabase.from("market_intelligence").upsert(payload, { onConflict: "shipment_id" });
        } catch (e) {
            console.error("Background MI save failed", e);
        }
    };

    const saveBenchmarkingToDb = async (benchmarking: any) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !activeShipmentId) return;

            await supabase.from("market_intelligence")
                .update({ benchmarking })
                .eq("shipment_id", activeShipmentId);
        } catch (e) {
            console.warn("Background benchmark save failed", e);
        }
    };

    const handleSelectMarket = async (market: Market) => {
        setSelectedMarket(market);
        setShelfPrice(String(market.averageRetailPrice));
        toast({ title: "Market Selected", description: `${market.countryName} set as destination target.` });

        // Background State Handover to shipments table
        if (activeShipmentId) {
            await supabase.from("shipments").update({ destination_country: market.countryName }).eq("id", activeShipmentId);
        }

        // Update URL parameters without reloading (if we are not in overlay, or even if we are, it's fine)
        if (!isOverlay) {
            const newParams = new URLSearchParams(searchParams);
            newParams.set("destination_country", market.countryName);
            setSearchParams(newParams);
        }

        setTimeout(() => {
            calculatorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
    };

    const handleProceed = async () => {
        // save benchmark latest values
        await saveBenchmarkingToDb({ shelfPrice: parseFloat(shelfPrice), marginPct: parseFloat(marginPct), targetExWorks: maxExWorks });

        toast({ title: "Data Synced to Database", description: "Calculator pre-filled.", variant: "default" });

        if (onPushToCalculator) {
            // Close the overlay/run the callback
            onPushToCalculator();
        } else {
            // Navigate to Landed Cost Engine
            const params = new URLSearchParams(searchParams);
            if (selectedMarket) params.set("destination_country", selectedMarket.countryName);
            params.set("from", "compass");
            navigate(`/landed-cost?${params.toString()}`);
        }
    };

    // Reverse computations
    const pShelf = parseFloat(shelfPrice) || 0;
    const pMargin = parseFloat(marginPct) || 0;
    const overheadPct = selectedMarket?.logisticsOverheadEstimate || 0;

    const landedCostTarget = pShelf * (1 - pMargin / 100);
    const maxExWorks = landedCostTarget * (1 - overheadPct / 100);

    // Formatting
    const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

    return (
        <div className="w-full space-y-6">

            {/* Provenance banner - only show if standalone and coming from classifier */}
            {fromClassifier && !isOverlay && (
                <div className="rounded-xl border border-primary/20 bg-primary/6 px-4 py-3.5 flex items-center gap-3 animate-fade-in">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                        <Brain className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">Data transferred from HS Neural-Navigator</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            HS code <span className="font-mono font-bold text-foreground">{hsCode}</span>
                            {activeShipmentId && <> · <span className="text-risk-low font-medium">✓ Shipment Context Active</span></>}
                        </p>
                    </div>
                    <button onClick={() => navigate("/hs-navigator")} className="ml-2 shrink-0 text-[11px] text-primary hover:underline flex items-center gap-1">
                        <ArrowLeft className="w-3 h-3" /> Back
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 focus-within:text-primary transition-colors">
                    <Label className="text-xs font-medium uppercase tracking-wide">Product Name</Label>
                    <Input placeholder="e.g. Premium Argan Oil" value={productName} onChange={e => setProductName(e.target.value)} />
                </div>
                <div className="space-y-1.5 focus-within:text-primary transition-colors">
                    <Label className="text-xs font-medium uppercase tracking-wide">HS Code</Label>
                    <Input placeholder="e.g. 1515.30" value={hsCode} onChange={e => setHsCode(e.target.value)} readOnly={fromClassifier && !isOverlay} className={cn(fromClassifier && !isOverlay && "bg-muted/50 text-muted-foreground")} />
                </div>
            </div>

            {/* ═══════════════ STEP 1: Opportunity Mapper ═══════════════ */}
            <Card className="border-border shadow-card mt-6">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center justify-between text-sm font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <Globe className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span>Module A: Opportunity Mapper</span>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={handleFetchIntelligence} disabled={loadingMarkets} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11">
                        {loadingMarkets ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Scanning Global Trade Flows...</> : <><Search className="w-4 h-4 mr-2" /> Analyze Best Export Markets</>}
                    </Button>

                    {loadingMarkets && (
                        <div className={cn("grid gap-4 mt-4 animate-pulse", isOverlay ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-32 bg-muted/40 rounded-xl border border-border"></div>
                            ))}
                        </div>
                    )}

                    {!loadingMarkets && markets.length > 0 && (
                        <div className="mt-6 space-y-4 animate-fade-in">
                            <div className={cn("grid gap-4", isOverlay ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3")}>
                                {markets.map((market, idx) => {
                                    const isSelected = selectedMarket?.countryCode === market.countryCode;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelectMarket(market)}
                                            className={cn("text-left rounded-xl border p-4 transition-all hover:shadow-elevated relative overflow-hidden",
                                                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/30")}
                                        >
                                            {idx === 0 && <div className="absolute top-0 right-0 bg-success/90 text-[9px] font-bold text-success-foreground px-2 py-0.5 rounded-bl-lg">TOP PICK</div>}
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-2xl leading-none" title={market.countryCode}>{String.fromCodePoint(...market.countryCode.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)))}</span>
                                                <span className="font-semibold text-sm">{market.countryName}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-[11px]">
                                                <div>
                                                    <p className="text-muted-foreground whitespace-nowrap">Import Vol.</p>
                                                    <p className="font-semibold">{market.annualImportValue}</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground whitespace-nowrap flex items-center gap-1"><TrendingUp className="w-3 h-3 text-success" /> Demand</p>
                                                    <div className="flex items-center gap-1">
                                                        <p className="font-mono text-success font-bold">{market.demandScore}</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground whitespace-nowrap">Retail Price</p>
                                                    <p className="font-mono font-semibold">{fmt(market.averageRetailPrice)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground whitespace-nowrap">Overhead Est.</p>
                                                    <p className="font-mono text-warning font-semibold">{market.logisticsOverheadEstimate}%</p>
                                                </div>
                                            </div>
                                            {isSelected && <div className="mt-3 flex items-center justify-center text-[10px] text-primary font-bold gap-1"><CheckCircle2 className="w-3 h-3" /> Target Set</div>}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ═══════════════ STEP 2: Competitor Benchmarking ═══════════════ */}
            <div ref={calculatorRef}>
                <Card className={cn("border-border shadow-card transition-all duration-300", !calculatorUnlocked && "opacity-60 grayscale-[50%]")}>
                    <CardHeader className="pb-4 border-b border-border/50">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <BarChart3 className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span>Module B: Competitor Benchmarking</span>
                            {!calculatorUnlocked && (
                                <Badge variant="outline" className="ml-auto text-[10px] border-border text-muted-foreground gap-1">
                                    <Lock className="w-2.5 h-2.5" /> Unlock
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        {!calculatorUnlocked && (
                            <div className="text-center py-6">
                                <p className="text-xs text-muted-foreground">The Reverse Calculator unlocks after selecting a target market above.</p>
                            </div>
                        )}
                        {calculatorUnlocked && (
                            <div className={cn("animate-fade-in grid gap-8", isOverlay ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>

                                {/* Inputs */}
                                <div className="space-y-4">
                                    <div className="space-y-1.5 focus-within:text-primary transition-colors">
                                        <Label className="text-xs font-medium uppercase tracking-wide">Target Shelf Price in {selectedMarket?.countryName} ($)</Label>
                                        <div className="relative">
                                            <DollarSign className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input type="number" value={shelfPrice} onChange={e => setShelfPrice(e.target.value)} className="pl-8" />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">Average reported: {fmt(selectedMarket?.averageRetailPrice || 0)}</p>
                                    </div>

                                    <div className="space-y-1.5 focus-within:text-primary transition-colors">
                                        <Label className="text-xs font-medium uppercase tracking-wide">Distributor / Retailer Margin (%)</Label>
                                        <div className="relative">
                                            <Input type="number" value={marginPct} onChange={e => setMarginPct(e.target.value)} className="pr-8" />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Gauge constraints */}
                                <div className="flex flex-col justify-center space-y-4 bg-muted/10 p-5 rounded-xl border border-border">
                                    <h3 className="text-xs font-bold text-center uppercase tracking-wider text-muted-foreground mb-2">Reverse Financial Target</h3>

                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Target Landed Price (DDP)</span>
                                        <span className="font-mono font-semibold">{fmt(landedCostTarget)}</span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm border-b border-border/50 pb-3">
                                        <span className="text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-warning" /> Est. Overhead ({overheadPct}%)</span>
                                        <span className="font-mono text-warning">-{fmt(landedCostTarget * overheadPct / 100)}</span>
                                    </div>

                                    <div className="flex justify-between items-center pt-2">
                                        <span className="font-bold text-foreground">Max Ex-Works Price</span>
                                        <span className="font-mono text-xl font-bold text-success bg-success/10 px-3 py-1 rounded-md">{fmt(maxExWorks)}</span>
                                    </div>

                                    <p className="text-[10px] text-muted-foreground text-center mt-2 leading-tight">
                                        To maintain a {marginPct}% margin at {fmt(pShelf)}, production bounds: {fmt(maxExWorks)}.
                                    </p>
                                </div>

                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Action Row */}
            {calculatorUnlocked && (
                <div className="flex justify-end pt-4 animate-fade-in">
                    <Button onClick={handleProceed} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md h-11 px-6">
                        {isOverlay ? (
                            <><Save className="w-4 h-4 mr-2" /> Push to Calculator & Close</>
                        ) : (
                            <>Compute Precise Landed Cost <ArrowRight className="w-4 h-4 ml-2" /></>
                        )}
                    </Button>
                </div>
            )}

        </div>
    );
}
