import { useState } from "react";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("admin");
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(username, password, role);
    if (success) {
      navigate("/dashboard");
    } else {
      toast({
        title: "Login Failed",
        description: "Invalid credentials. Try admin/admin or user/user.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Camera className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">ConsentHub</CardTitle>
          <CardDescription>
            Media Consent Management System
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Login as</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={role === "admin" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setRole("admin")}
                >
                  Admin
                </Button>
                <Button
                  type="button"
                  variant={role === "user" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setRole("user")}
                >
                  User
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full">
              Sign In
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Sample: admin/admin or user/user
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
