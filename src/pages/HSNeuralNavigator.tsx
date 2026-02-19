import { AppLayout } from "@/components/AppLayout";
import { Brain } from "lucide-react";

export default function HSNeuralNavigator() {
  return (
    <AppLayout title="HS Neural-Navigator" subtitle="AI-powered HS code classification">
      <div className="flex items-center justify-center h-80 bg-card rounded-lg border border-border shadow-card">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-3">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">HS Neural-Navigator</p>
          <p className="text-xs text-muted-foreground mt-1">Coming soon — AI-assisted tariff classification</p>
        </div>
      </div>
    </AppLayout>
  );
}
