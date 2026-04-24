import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  User,
  Settings,
  ChevronLeft,
  Database,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
}

export const Sidebar = ({ userRole = "user", userName = "User", userEmail = "user@example.com" }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const isAdmin = userRole === "admin";

  const menuItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: isAdmin ? "/admin/projects" : "/dashboard",
      roles: ["admin", "user"],
    },
    {
      label: "Create Project",
      icon: FolderKanban,
      path: "/projects/create",
      roles: ["admin", "user"],
    },
    {
      label: "Dataset",
      icon: Database,
      path: "/admin/dataset",
      roles: ["admin", "user"],
    },
  ];

  const visibleItems = menuItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path);
  };

  if (collapsed) {
    return (
      <div className="w-16 bg-sidebar-background border-r border-sidebar-border flex flex-col items-center py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground font-bold mb-6">
          C
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
        >
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col">
      {/* Logo/Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground font-bold">
          C
        </div>
        <div>
          <h1 className="text-sm font-semibold text-sidebar-foreground">ConsentMap</h1>
          <p className="text-xs text-muted-foreground">Privacy Management</p>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-sm">
            {userName.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
        </div>
        <Badge className="mt-2 bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30">
          {userRole}
        </Badge>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent",
                  active && "bg-sidebar-accent text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 mr-3" />
                <span className="text-sm">{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Quick Stats Section removed because data was hardcoded dummy data for UI layout */}

      {/* Collapse Toggle */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(true)}
          className="w-full justify-start text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          <span className="text-sm">Hide</span>
        </Button>
      </div>
    </div>
  );
};

