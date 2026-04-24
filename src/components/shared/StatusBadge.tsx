import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig = {
  // Consent Status
  matching: {
    label: "Matching",
    className: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 shadow-sm",
  },
  not_matching: {
    label: "Not Matching",
    className: "bg-gradient-to-r from-red-500 to-rose-500 text-white border-0 shadow-sm",
  },
  pending: {
    label: "Pending",
    className: "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-sm",
  },
  granted: {
    label: "Granted",
    className: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-sm",
  },
  
  // Project Status
  active: {
    label: "Active",
    className: "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-sm",
  },
  draft: {
    label: "Draft",
    className: "bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0 shadow-sm",
  },
  review: {
    label: "Review",
    className: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0 shadow-sm",
  },
  completed: {
    label: "Completed",
    className: "bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 shadow-sm",
  },
  archived: {
    label: "Archived",
    className: "bg-gradient-to-r from-gray-500 to-gray-600 text-white border-0 shadow-sm",
  },
  
  // Image Status
  uploaded: {
    label: "Uploaded",
    className: "bg-gradient-to-r from-blue-400 to-blue-500 text-white border-0 shadow-sm",
  },
  processing: {
    label: "Processing",
    className: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-0 shadow-sm",
  },
  redacted: {
    label: "Redacted",
    className: "bg-gradient-to-r from-green-400 to-emerald-500 text-white border-0 shadow-sm",
  },
  approved: {
    label: "Approved",
    className: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 shadow-sm",
  },
  failed: {
    label: "Failed",
    className: "bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 shadow-sm",
  },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status.toLowerCase() as keyof typeof statusConfig] || {
    label: status,
    className: "bg-gradient-to-r from-gray-400 to-gray-500 text-white border-0",
  };

  return (
    <Badge className={cn(config.className, "font-medium", className)}>
      {config.label}
    </Badge>
  );
};
