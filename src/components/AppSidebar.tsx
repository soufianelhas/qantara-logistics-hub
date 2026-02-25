import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calculator,
  Brain,
  ShieldCheck,
  Anchor,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  LogOut,
  Archive,
  Users,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const workflowItems = [
  { title: "HS Neural-Navigator",     url: "/hs-navigator",            icon: Brain,       step: 1 },
  { title: "Landed Cost Engine",      url: "/landed-cost",             icon: Calculator,  step: 2 },
  { title: "Documentation Workshop",  url: "/documentation-workshop",  icon: FolderOpen,  step: 3 },
];

const otherItems = [
  { title: "Dashboard",           url: "/",                    icon: LayoutDashboard },
  { title: "Clients",             url: "/clients",             icon: Users },
  { title: "Authenticity Studio", url: "/authenticity-studio", icon: ShieldCheck },
  { title: "Archive",             url: "/shipments",           icon: Archive },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
  const location = useLocation();

  return (
    <aside
      className={cn(
        "relative flex flex-col sticky top-0 h-screen transition-all duration-300 ease-in-out",
        "border-r border-sidebar-border",
        collapsed ? "w-16" : "w-60"
      )}
      style={{ background: "var(--gradient-sidebar)" }}
    >
      {/* Logo area */}
      <div
        className={cn(
          "flex items-center h-16 px-4 border-b border-navy-light/30",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-beige/10 border border-beige/20 flex items-center justify-center">
          <Anchor className="w-4 h-4 text-beige" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <p className="text-sm font-semibold tracking-wide text-beige leading-tight">Qantara</p>
            <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">Logistics OS</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">

        {/* Dashboard */}
        {otherItems.filter(i => i.url === "/").map((item) => {
          const isActive = location.pathname === "/";
          return (
            <NavLink
              key={item.url}
              to={item.url}
              end
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 group",
                collapsed ? "justify-center px-2" : "",
                isActive
                  ? "bg-beige/10 text-beige border border-beige/15 shadow-sm"
                  : "text-sidebar-foreground hover:bg-navy-light/60 hover:text-sidebar-accent-foreground border border-transparent"
              )}
            >
              <item.icon className={cn("flex-shrink-0 transition-colors", collapsed ? "w-5 h-5" : "w-4 h-4", isActive ? "text-beige" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground")} />
              {!collapsed && <span className="truncate font-medium animate-fade-in">{item.title}</span>}
              {isActive && !collapsed && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-beige/70 flex-shrink-0" />}
            </NavLink>
          );
        })}

        {/* Workflow section label */}
        {!collapsed && (
          <div className="px-3 pt-4 pb-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/40">
              Export Workflow
            </p>
          </div>
        )}
        {collapsed && <div className="my-3 mx-2 border-t border-navy-light/30" />}

        {/* Workflow steps */}
        {workflowItems.map((item) => {
          const isActive = location.pathname.startsWith(item.url);
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 group",
                collapsed ? "justify-center px-2" : "",
                isActive
                  ? "bg-beige/10 text-beige border border-beige/15 shadow-sm"
                  : "text-sidebar-foreground hover:bg-navy-light/60 hover:text-sidebar-accent-foreground border border-transparent"
              )}
            >
              {/* Step circle */}
              {!collapsed ? (
                <div className={cn(
                  "flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold transition-colors",
                  isActive
                    ? "border-beige/60 bg-beige/15 text-beige"
                    : "border-sidebar-foreground/30 text-sidebar-foreground/50 group-hover:border-sidebar-accent-foreground/50 group-hover:text-sidebar-accent-foreground"
                )}>
                  {item.step}
                </div>
              ) : (
                <item.icon className={cn("flex-shrink-0 w-5 h-5 transition-colors", isActive ? "text-beige" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground")} />
              )}
              {!collapsed && (
                <span className="truncate font-medium animate-fade-in flex-1">{item.title}</span>
              )}
              {isActive && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-beige/70 flex-shrink-0" />
              )}
            </NavLink>
          );
        })}

        {/* Other items section */}
        {!collapsed && (
          <div className="px-3 pt-4 pb-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/40">
              Tools
            </p>
          </div>
        )}
        {collapsed && <div className="my-3 mx-2 border-t border-navy-light/30" />}

        {/* Authenticity Studio */}
        {otherItems.filter(i => i.url !== "/").map((item) => {
          const isActive = location.pathname.startsWith(item.url);
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 group",
                collapsed ? "justify-center px-2" : "",
                isActive
                  ? "bg-beige/10 text-beige border border-beige/15 shadow-sm"
                  : "text-sidebar-foreground hover:bg-navy-light/60 hover:text-sidebar-accent-foreground border border-transparent"
              )}
            >
              <item.icon className={cn("flex-shrink-0 transition-colors", collapsed ? "w-5 h-5" : "w-4 h-4", isActive ? "text-beige" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground")} />
              {!collapsed && <span className="truncate font-medium animate-fade-in">{item.title}</span>}
              {isActive && !collapsed && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-beige/70 flex-shrink-0" />}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-navy-light/30 animate-fade-in space-y-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-navy-light/40 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="text-xs">Sign Out</span>
          </button>
          <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-widest">
            Morocco Export Hub
          </p>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute -right-3 top-20 z-10",
          "w-6 h-6 rounded-full border border-border bg-card shadow-card",
          "flex items-center justify-center",
          "text-muted-foreground hover:text-foreground transition-colors",
          "hover:shadow-elevated"
        )}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
