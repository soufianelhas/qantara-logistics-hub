import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Search } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-auto h-screen">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
          <div>
            <h1 className="text-base font-semibold text-foreground tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button className="w-8 h-8 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
              <Search className="w-4 h-4" />
            </button>
            <button className="relative w-8 h-8 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-risk-high" />
            </button>
            <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center">
              <span className="text-xs font-semibold text-beige">MA</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
