import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sampleProjects } from "@/data/sampleData";
import { useAuth } from "@/contexts/AuthContext";
import { Eye } from "lucide-react";

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const enrolled = sampleProjects.filter((p) =>
    p.enrolledUsers.includes(user?.username ?? "")
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in-0 duration-300">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Projects</h1>
          <p className="text-sm text-muted-foreground">Projects you are enrolled in</p>
        </div>

        {enrolled.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">You are not enrolled in any projects.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enrolled.map((project) => (
              <Card key={project.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge variant="secondary" className="capitalize">{project.status}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Since {project.createdAt}</span>
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
