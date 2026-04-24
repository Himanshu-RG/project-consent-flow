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
import { Upload, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createProject, updateProject } from "@/lib/api/projects";
import { useAuth } from "@/contexts/AuthContext";


const CreateProject = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const existing = null; // edit mode pre-fill removed (sampleData deleted)

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

  // File upload states
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedPDFs, setSelectedPDFs] = useState<File[]>([]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => 
        file.type.startsWith('image/')
      );
      setSelectedImages(prev => [...prev, ...newFiles]);
    }
  };

  const handlePDFSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => 
        file.type === 'application/pdf'
      );
      setSelectedPDFs(prev => [...prev, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const removePDF = (index: number) => {
    setSelectedPDFs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    
    try {
      const projectData = {
        name,
        description,
        notes,
        target_image_count: targetImageCount,
        status: status as "active" | "completed" | "on-hold" | "archived",
        camera_dslr: cameraDslr,
        camera_mobile: cameraMobile,
        pii_face: piiFace,
        pii_objects: piiObjects,
        pii_document: piiDocument,
        pii_other: piiOther,
        owner_id: user?.id,
      };

      if (existing && id) {
        await updateProject(id, projectData);
        toast({
          title: "Project Updated",
          description: `"${name}" has been updated successfully.`,
        });
      } else {
        // Create project with files
        const formData = new FormData();
        
        // Add project data
        Object.entries(projectData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            formData.append(key, value.toString());
          }
        });

        // Add images
        selectedImages.forEach(file => {
          formData.append('images', file);
        });

        // Add PDFs
        selectedPDFs.forEach(file => {
          formData.append('consent_pdfs', file);
        });

        await createProject(formData);
        toast({
          title: "Project Created",
          description: `"${name}" has been created successfully with ${selectedImages.length} image(s) and ${selectedPDFs.length} PDF(s).`,
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
              <CardTitle className="text-lg">Upload Files (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="image-upload">Project Images</Label>
                <div className="flex gap-2">
                  <Input
                    id="image-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={() => document.getElementById('image-upload')?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Browse
                  </Button>
                </div>
                {selectedImages.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-muted-foreground">{selectedImages.length} image(s) selected:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {selectedImages.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                          <span className="truncate flex-1">{file.name}</span>
                          <span className="text-xs text-muted-foreground mx-2">{(file.size / 1024).toFixed(1)} KB</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeImage(index)}
                            className="h-6 w-6 p-0"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* PDF Upload */}
              <div className="space-y-2">
                <Label htmlFor="pdf-upload">Consent PDFs</Label>
                <div className="flex gap-2">
                  <Input
                    id="pdf-upload"
                    type="file"
                    multiple
                    accept="application/pdf"
                    onChange={handlePDFSelect}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={() => document.getElementById('pdf-upload')?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Browse
                  </Button>
                </div>
                {selectedPDFs.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-muted-foreground">{selectedPDFs.length} PDF(s) selected:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {selectedPDFs.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                          <span className="truncate flex-1">{file.name}</span>
                          <span className="text-xs text-muted-foreground mx-2">{(file.size / 1024).toFixed(1)} KB</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePDF(index)}
                            className="h-6 w-6 p-0"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : (existing ? "Save Changes" : "Create Project")}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default CreateProject;
