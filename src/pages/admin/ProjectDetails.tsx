import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  ImagePlus,
  FileText,
  Image,
  Table as TableIcon,
  Images,
  Loader2,
  Camera,
  Shield,
  UserCheck,
} from "lucide-react";
import { getProject, deleteProject, processProject } from "@/lib/api/projects";
import { listImages } from "@/lib/api/images";
import { listConsentForms } from "@/lib/api/consent";
import { getPersons } from "@/lib/api/persons";
import type { ProjectResponse, ImageResponse, ConsentFormResponse, PersonResponse } from "@/lib/api-types";
import { ImageUploadDialog } from "@/components/dialogs/ImageUploadDialog";
import { ConsentUploadDialog } from "@/components/dialogs/ConsentUploadDialog";
import { UserEnrollmentManager } from "@/components/admin/UserEnrollmentManager";
import { ConsentStatusTable } from "@/components/admin/ConsentStatusTable";

const AdminProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State for project data
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [consentForms, setConsentForms] = useState<ConsentFormResponse[]>([]);
  const [persons, setPersons] = useState<PersonResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal states
  const [addConsentOpen, setAddConsentOpen] = useState(false);
  const [addImagesOpen, setAddImagesOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch project data on mount
  useEffect(() => {
    const fetchProjectData = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        
        // Fetch project details
        const projectData = await getProject(id);
        setProject(projectData);

        // Fetch images for this project
        const imagesData = await listImages(id);
        setImages(imagesData);

        // Fetch consent forms for this project
        const consentData = await listConsentForms(id);
        setConsentForms(consentData);

        // Fetch persons for this project
        const personsData = await getPersons(id);
        setPersons(personsData);

      } catch (error: any) {
        toast({
          title: "Failed to Load Project",
          description: error.message || "Could not fetch project details",
          variant: "destructive",
        });
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectData();
  }, [id, navigate, toast]);

  const handleProcessProject = async () => {
    if (!id) return;
    
    setIsProcessing(true);
    try {
      await processProject(id);
      toast({
        title: "Processing Started",
        description: "Project images are being processed for face recognition.",
      });
      // Refresh data to show any immediate changes (though processing might be async)
      await refreshProjectData();
    } catch (error: any) {
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to start processing",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!id) return;

    try {
      await deleteProject(id);
      toast({
        title: "Project Deleted",
        description: "Project has been deleted successfully",
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  const refreshProjectData = async () => {
    if (!id) return;
    
    try {
      const imagesData = await listImages(id);
      setImages(imagesData);
      
      const consentData = await listConsentForms(id);
      setConsentForms(consentData);
    } catch (error: any) {
      console.error("Failed to refresh data:", error);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "completed": return "secondary";
      case "on-hold": return "outline";
      case "archived": return "destructive";
      default: return "default";
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <p className="text-muted-foreground">Project not found</p>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in-0 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
              <p className="text-sm text-muted-foreground">
                Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
                variant="outline" 
                onClick={handleProcessProject}
                disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mr-2 h-4 w-4"
                    >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Process
                </div>
              )}
               Process
            </Button>
            <Button onClick={() => navigate(`/projects/${id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" /> Edit Project
            </Button>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        {/* Project Info Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={statusColor(project.status) as any} className="capitalize">
                {project.status}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Images</CardTitle>
              <Images className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{images.length}</div>
              <p className="text-xs text-muted-foreground">
                Target: {project.target_image_count}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Consent Forms</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{consentForms.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Camera Types</CardTitle>
              <Camera className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {project.camera_dslr && <Badge variant="outline">DSLR</Badge>}
                {project.camera_mobile && <Badge variant="outline">Mobile</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.description && (
              <div>
                <h3 className="text-sm font-medium mb-1">Description</h3>
                <p className="text-sm text-muted-foreground">{project.description}</p>
              </div>
            )}
            {project.notes && (
              <div>
                <h3 className="text-sm font-medium mb-1">Notes</h3>
                <p className="text-sm text-muted-foreground">{project.notes}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium mb-2">PII Collection</h3>
              <div className="flex flex-wrap gap-2">
                {project.pii_face && <Badge variant="secondary">Face</Badge>}
                {project.pii_objects && <Badge variant="secondary">Objects</Badge>}
                {project.pii_document && <Badge variant="secondary">Documents</Badge>}
                {project.pii_other && <Badge variant="secondary">Other</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Images and Consent Forms */}
        <Tabs defaultValue="images" className="w-full">
          <TabsList>
            <TabsTrigger value="images">Images ({images.length})</TabsTrigger>
            <TabsTrigger value="consent">Consent Forms ({consentForms.length})</TabsTrigger>
            <TabsTrigger value="persons">People ({persons.length})</TabsTrigger>
            <TabsTrigger value="enrollment">Enrollment</TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Project Images</h3>
              <Button onClick={() => setAddImagesOpen(true)}>
                <ImagePlus className="mr-2 h-4 w-4" /> Upload Images
              </Button>
            </div>
            {images.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Image className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No images uploaded yet</p>
                  <Button onClick={() => setAddImagesOpen(true)} className="mt-4">
                    Upload First Image
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image) => (
                  <Card key={image.id} className="overflow-hidden">
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      <Image className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate">{image.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {image.width} x {image.height}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="consent" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Consent Forms</h3>
              <Button onClick={() => setAddConsentOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Upload Consent Form
              </Button>
            </div>
            {consentForms.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No consent forms uploaded yet</p>
                  <Button onClick={() => setAddConsentOpen(true)} className="mt-4">
                    Upload First Consent Form
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {consentForms.map((form) => (
                  <Card key={form.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{form.form_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {form.signed_date ? `Signed: ${new Date(form.signed_date).toLocaleDateString()}` : 'Not signed'}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">View</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="persons" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Detected People</h3>
            </div>
            
            {persons.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                     <span className="text-xl font-bold text-muted-foreground">?</span>
                  </div>
                  <p className="text-muted-foreground">No people detected yet. Process images to detect faces.</p>
                  <Button 
                    onClick={handleProcessProject} 
                    className="mt-4"
                    disabled={isProcessing}
                    variant="outline"
                  >
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Process Project
                  </Button>
                </CardContent>
              </Card>
            ) : (
                <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Identity</TableHead>
                            <TableHead>Linked User</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {persons.map((person) => (
                            <TableRow key={person.id}>
                                <TableCell className="font-medium">{person.name}</TableCell>
                                <TableCell>
                                    <Badge 
                                        variant={
                                            person.consent_status === 'granted' ? 'default' : // default is roughly success in shadcn usually primary
                                            person.consent_status === 'denied' ? 'destructive' : 
                                            'outline'
                                        }
                                        className={
                                            person.consent_status === 'granted' ? "bg-green-500 hover:bg-green-600" : ""
                                        }
                                    >
                                        {person.consent_status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {person.face_embedding ? (
                                        <Badge variant="outline" className="border-green-500 text-green-500 bg-green-50">
                                            Face ID
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {person.user_id ? (
                                        <div className="flex items-center gap-1 text-blue-600">
                                            <UserCheck className="h-4 w-4" />
                                            <span className="text-xs">Linked</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="sm">
                                        View
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </div>
            )}
          </TabsContent>

          {/* Enrollment Tab */}
          <TabsContent value="enrollment" className="space-y-4">
            <UserEnrollmentManager 
              projectId={id!} 
              onEnrollmentChange={() => setRefreshTrigger(prev => prev + 1)}
            />
            <ConsentStatusTable 
              projectId={id!} 
              refreshTrigger={refreshTrigger}
            />
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the project "{project.name}" and all associated data.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground">
                Delete Project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Upload Dialogs */}
        <ImageUploadDialog
          open={addImagesOpen}
          onOpenChange={setAddImagesOpen}
          projectId={id!}
          onUploadComplete={refreshProjectData}
        />
        
        <ConsentUploadDialog
          open={addConsentOpen}
          onOpenChange={setAddConsentOpen}
          projectId={id!}
          onUploadComplete={refreshProjectData}
        />
      </div>
    </AppLayout>
  );
};

export default AdminProjectDetails;
