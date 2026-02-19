import { AppLayout } from "@/components/AppLayout";
import { ShieldCheck } from "lucide-react";

export default function AuthenticityStudio() {
  return (
    <AppLayout title="Authenticity Studio" subtitle="Certificate & document verification">
      <div className="flex items-center justify-center h-80 bg-card rounded-lg border border-border shadow-card">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Authenticity Studio</p>
          <p className="text-xs text-muted-foreground mt-1">Coming soon — origin certificates & compliance docs</p>
        </div>
      </div>
    </AppLayout>
  );
}
