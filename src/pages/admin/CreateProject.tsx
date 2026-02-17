import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sampleProjects } from "@/data/sampleData";
import { Upload, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CreateProject = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const existing = id ? sampleProjects.find((p) => p.id === id) : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [status, setStatus] = useState<string>(existing?.status ?? "draft");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: existing ? "Project Updated" : "Project Created",
      description: `"${name}" has been ${existing ? "updated" : "created"} successfully.`,
    });
    navigate("/dashboard");
  };

  const handleUpload = (type: string) => {
    toast({
      title: `${type} Upload`,
      description: `${type} upload will be connected to storage later.`,
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6 animate-in fade-in-0 duration-300">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <h1 className="text-2xl font-bold text-foreground">
          {existing ? "Edit Project" : "Create Project"}
        </h1>

        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter project name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the project..." rows={4} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Uploads</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="outline" className="flex-1" onClick={() => handleUpload("Images")}>
                <Upload className="mr-2 h-4 w-4" /> Upload Images
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => handleUpload("Consent PDFs")}>
                <Upload className="mr-2 h-4 w-4" /> Upload Consent PDFs
              </Button>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit">{existing ? "Save Changes" : "Create Project"}</Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default CreateProject;
