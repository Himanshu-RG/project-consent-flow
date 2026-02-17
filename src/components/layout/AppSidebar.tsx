import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FolderPlus,
  LogOut,
  Menu,
  X,
  Camera,
  User,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const navItems = [
    {
      label: "Dashboard",
      to: "/dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "user"] as const,
    },
    {
      label: "Create Project",
      to: "/projects/create",
      icon: FolderPlus,
      roles: ["admin"] as const,
    },
  ];

  const filtered = navItems.filter((item) =>
    (item.roles as readonly string[]).includes(user.role)
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed left-4 top-4 z-50 md:hidden rounded-md border border-border bg-background p-2"
        onClick={() => setOpen(!open)}
        aria-label="Toggle sidebar"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar-background transition-transform duration-300 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 border-b border-border px-6 py-5">
          <Camera className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-sidebar-foreground">
            ConsentHub
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {filtered.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
              onClick={() => setOpen(false)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-sidebar-foreground">
            <User className="h-4 w-4" />
            <span className="font-medium capitalize">{user.username}</span>
            <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground capitalize">
              {user.role}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
}
