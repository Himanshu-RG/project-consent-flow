import { Moon, Sun, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  userName?: string;
  userRole?: string;
}

export const Header = ({ userName = "User", userRole = "user" }: HeaderProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const roleColors = {
    admin: "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0",
    user: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0",
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-gradient-to-r from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 px-6 shadow-sm">
      {/* Left side - could add search or other elements */}
      <div className="flex items-center gap-4">
        <div className="h-8 w-1 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 rounded-full" />
      </div>

      {/* Right side - User menu and theme toggle */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          className="relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 opacity-0 group-hover:opacity-20 transition-opacity" />
          {theme === "light" ? (
            <Moon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
          ) : (
            <Sun className="h-5 w-5 text-amber-500" />
          )}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 hover:bg-white/60 dark:hover:bg-slate-800/60">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md">
                <User className="h-4 w-4" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">{userName}</span>
                <Badge
                  className={roleColors[userRole as keyof typeof roleColors] || roleColors.user}
                >
                  {userRole}
                </Badge>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/user/dashboard")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <User className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

