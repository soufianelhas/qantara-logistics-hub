import { AppLayout } from "@/components/AppLayout";
import { Calculator } from "lucide-react";

export default function LandedCostEngine() {
  return (
    <AppLayout title="Landed Cost Engine" subtitle="Calculate total import costs">
      <div className="flex items-center justify-center h-80 bg-card rounded-lg border border-border shadow-card">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-3">
            <Calculator className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Landed Cost Engine</p>
          <p className="text-xs text-muted-foreground mt-1">Coming soon — duty, freight & insurance calculator</p>
        </div>
      </div>
    </AppLayout>
  );
}
