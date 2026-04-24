import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getProjects } from "@/lib/api/projects";
import type { ProjectResponse } from "@/lib/api-types";
import { Eye, Loader2, FolderOpen } from "lucide-react";

const UserDashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const { toast } = useToast();

  // Fetch all active projects from the real API
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoadingProjects(true);
        const data = await getProjects(1, 100);
        setProjects(data.projects ?? []);
      } catch (err: any) {
        toast({
          title: "Failed to load projects",
          description: err.message || "Could not fetch projects",
          variant: "destructive",
        });
      } finally {
        setIsLoadingProjects(false);
      }
    };
    fetchProjects();
  }, [toast]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in-0 duration-300">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Projects</h1>
          <p className="text-sm text-muted-foreground">Browse and view all active projects</p>
        </div>

        {isLoadingProjects ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No projects available yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge variant="secondary" className="capitalize">{project.status}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/user/projects/${project.id}`)}>
                    <Eye className="mr-1 h-4 w-4" /> View
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default UserDashboard;
