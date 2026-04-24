import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Breadcrumbs } from "./Breadcrumbs";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: ReactNode;
  userName?: string;
  userEmail?: string;
  userRole?: string;
}

export const AppLayout = ({
  children,
  userName,
  userEmail,
  userRole,
}: AppLayoutProps) => {
  const { user } = useAuth();
  
  const finalUserName = userName || user?.full_name || user?.email || "User";
  const finalUserEmail = userEmail || user?.email || "";
  const finalUserRole = userRole || user?.role || "user";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar userRole={finalUserRole} userName={finalUserName} userEmail={finalUserEmail} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header userName={finalUserName} userRole={finalUserRole} />

        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
};
