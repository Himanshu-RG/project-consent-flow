import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { sampleProjects } from "@/data/sampleData";
import { Upload, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createProject, updateProject } from "@/lib/api/projects";
import { useAuth } from "@/contexts/AuthContext";


const CreateProject = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const existing = id ? sampleProjects.find((p) => p.id === id) : null;

  // Basic fields
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [notes, setNotes] = useState("");
  const [targetImageCount, setTargetImageCount] = useState(0);
  const [status, setStatus] = useState<string>(existing?.status ?? "active");

  // Camera types
  const [cameraDslr, setCameraDslr] = useState(false);
  const [cameraMobile, setCameraMobile] = useState(false);

  // PII types
  const [piiFace, setPiiFace] = useState(false);
  const [piiObjects, setPiiObjects] = useState(false);
  const [piiDocument, setPiiDocument] = useState(false);
  const [piiOther, setPiiOther] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    
    try {
      const projectData = {
        name,
        description,
        notes,
        target_image_count: targetImageCount,
        status,
        camera_dslr: cameraDslr,
        camera_mobile: cameraMobile,
        pii_face: piiFace,
        pii_objects: piiObjects,
        pii_document: piiDocument,
        pii_other: piiOther,
        owner_id: user?.id, // Add logged-in user's ID
      };

      if (existing && id) {
        await updateProject(id, projectData);
        toast({
          title: "Project Updated",
          description: `"${name}" has been updated successfully.`,
        });
      } else {
        await createProject(projectData);
        toast({
          title: "Project Created",
          description: `"${name}" has been created successfully.`,
        });
      }
      
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: existing ? "Update Failed" : "Creation Failed",
        description: error.message || "Failed to save project. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
                <Label htmlFor="name">Project Name *</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Enter project name" 
                  required 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea 
                  id="desc" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Describe the project..." 
                  rows={3} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea 
                  id="notes" 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Additional notes..." 
                  rows={3} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetCount">Target Image Count</Label>
                <Input 
                  id="targetCount" 
                  type="number" 
                  min="0"
                  value={targetImageCount} 
                  onChange={(e) => setTargetImageCount(parseInt(e.target.value) || 0)} 
                  placeholder="0" 
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Camera Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="cameraDslr" 
                  checked={cameraDslr}
                  onCheckedChange={(checked) => setCameraDslr(checked as boolean)}
                />
                <Label htmlFor="cameraDslr" className="font-normal cursor-pointer">
                  DSLR Camera
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="cameraMobile" 
                  checked={cameraMobile}
                  onCheckedChange={(checked) => setCameraMobile(checked as boolean)}
                />
                <Label htmlFor="cameraMobile" className="font-normal cursor-pointer">
                  Mobile Camera
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">PII (Personally Identifiable Information)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="piiFace" 
                  checked={piiFace}
                  onCheckedChange={(checked) => setPiiFace(checked as boolean)}
                />
                <Label htmlFor="piiFace" className="font-normal cursor-pointer">
                  Face Recognition
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="piiObjects" 
                  checked={piiObjects}
                  onCheckedChange={(checked) => setPiiObjects(checked as boolean)}
                />
                <Label htmlFor="piiObjects" className="font-normal cursor-pointer">
                  Objects/Items
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="piiDocument" 
                  checked={piiDocument}
                  onCheckedChange={(checked) => setPiiDocument(checked as boolean)}
                />
                <Label htmlFor="piiDocument" className="font-normal cursor-pointer">
                  Documents
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="piiOther" 
                  checked={piiOther}
                  onCheckedChange={(checked) => setPiiOther(checked as boolean)}
                />
                <Label htmlFor="piiOther" className="font-normal cursor-pointer">
                  Other PII
                </Label>
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
