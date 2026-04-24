import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  // Map route segments to readable labels
  const getLabelForSegment = (segment: string, index: number) => {
    const labels: Record<string, string> = {
      admin: "Admin",
      user: "User",
      dashboard: "Dashboard",
      projects: "Projects",
      settings: "Settings",
    };

    // If it's a UUID or ID, try to get a more meaningful label
    if (
      segment.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    ) {
      return "Details";
    }

    return labels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  // Don't show breadcrumbs on login page
  if (location.pathname === "/login") {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 px-6 py-3 text-sm text-muted-foreground">
      <Link
        to="/"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>

      {pathnames.map((segment, index) => {
        const path = `/${pathnames.slice(0, index + 1).join("/")}`;
        const isLast = index === pathnames.length - 1;
        const label = getLabelForSegment(segment, index);

        return (
          <div key={path} className="flex items-center space-x-2">
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link
                to={path}
                className="hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
};
