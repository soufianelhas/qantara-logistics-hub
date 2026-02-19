import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calculator,
  Brain,
  ShieldCheck,
  Anchor,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Landed Cost Engine",
    url: "/landed-cost",
    icon: Calculator,
  },
  {
    title: "HS Neural-Navigator",
    url: "/hs-navigator",
    icon: Brain,
  },
  {
    title: "Authenticity Studio",
    url: "/authenticity-studio",
    icon: ShieldCheck,
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        "relative flex flex-col min-h-screen transition-all duration-300 ease-in-out",
        "border-r border-navy-light/30",
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
            <p className="text-sm font-semibold tracking-wide text-beige leading-tight">
              Qantara
            </p>
            <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">
              Logistics OS
            </p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.url === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.url);

          return (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 group",
                collapsed ? "justify-center px-2" : "",
                isActive
                  ? "bg-beige/10 text-beige border border-beige/15 shadow-sm"
                  : "text-sidebar-foreground hover:bg-navy-light/60 hover:text-sidebar-accent-foreground border border-transparent"
              )}
            >
              <item.icon
                className={cn(
                  "flex-shrink-0 transition-colors",
                  collapsed ? "w-5 h-5" : "w-4 h-4",
                  isActive ? "text-beige" : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
                )}
              />
              {!collapsed && (
                <span className="truncate font-medium animate-fade-in">
                  {item.title}
                </span>
              )}
              {isActive && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-beige/70 flex-shrink-0" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-navy-light/30 animate-fade-in">
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
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
}
