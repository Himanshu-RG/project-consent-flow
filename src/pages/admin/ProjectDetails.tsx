import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Download,

  Shield,
  UserCheck,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import { getProject, deleteProject, processProject, uploadPersonConsent, subscribeToProcessProgress } from "@/lib/api/projects";
import { listImages } from "@/lib/api/images";
import { listConsentForms, deleteConsentForm } from "@/lib/api/consent";
import { getPersons, getKnownPersons, updatePerson, promotePerson, deletePerson } from "@/lib/api/persons";
import type { ProjectResponse, ImageResponse, ConsentFormResponse, PersonResponse, KnownPersonResponse, PersonDetection } from "@/lib/api-types";
import { Input } from "@/components/ui/input";
import { ImageUploadDialog } from "@/components/dialogs/ImageUploadDialog";
import { ConsentUploadDialog } from "@/components/dialogs/ConsentUploadDialog";
import { UserEnrollmentManager } from "@/components/admin/UserEnrollmentManager";
import { ConsentStatusTable } from "@/components/admin/ConsentStatusTable";
import { ManualRedactModal } from "@/components/shared/ManualRedactModal";

const FaceDetectionCard = ({ detection, person }: { detection: PersonDetection, person: PersonResponse }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const imgUrl = detection.image_url.startsWith('http') 
    ? detection.image_url 
    : `http://localhost:8000${detection.image_url}`;

  return (
    <div className="relative flex-none w-full bg-black flex items-center justify-center snap-center" style={{ minWidth: "100%", minHeight: 400 }}>
      {/* Hidden source image */}
      <img
        ref={imgRef}
        src={imgUrl}
        alt="source"
        className="hidden"
        onError={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            
            canvas.width = 600;
            canvas.height = 400;
            ctx.fillStyle = "#0f172a"; // slate-900 background
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#64748b"; // slate-500 text
            ctx.font = "18px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Image file not available on server", canvas.width / 2, canvas.height / 2);
        }}
        onLoad={() => {
          const img = imgRef.current;
          const canvas = canvasRef.current;
          if (!img || !canvas) return;

          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          // Draw the base image
          ctx.drawImage(img, 0, 0);

          const bbox = detection.bbox;
          if (bbox) {
            const status = person.consent_status;
            const color =
              status === "granted" ? "#22c55e" :
              status === "denied"  ? "#ef4444" :
                                     "#eab308";

            const { x, y, width, height } = bbox;

            // Glow / shadow
            ctx.shadowColor = color;
            ctx.shadowBlur = 18;

            // Bounding box stroke
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(3, canvas.width * 0.003);
            ctx.strokeRect(x, y, width, height);

            // Label background
            const fontSize = Math.max(14, canvas.width * 0.018);
            ctx.font = `bold ${fontSize}px sans-serif`;
            const label = person.name ?? "Person";
            const textW = ctx.measureText(label).width;
            const padX = 8, padY = 4;
            const labelH = fontSize + padY * 2;
            const labelY = y - labelH > 0 ? y - labelH : y + height;

            ctx.shadowBlur = 0;
            ctx.fillStyle = color;
            ctx.fillRect(x, labelY, textW + padX * 2, labelH);

            // Label text
            ctx.fillStyle = "#000";
            ctx.fillText(label, x + padX, labelY + fontSize + padY - 2);
          }
        }}
      />
      {/* Visible canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-auto max-h-[60vh] object-contain"
        style={{ display: "block" }}
      />
      
      {/* Detection info overlay */}
      <div className="absolute bottom-4 left-4 flex gap-2">
         {detection.confidence != null && (
             <div className="bg-black/60 text-white text-xs font-medium px-2 py-1 rounded backdrop-blur border border-white/10 shadow-lg">
               Confidence: {(detection.confidence * 100).toFixed(1)}%
             </div>
         )}
      </div>
    </div>
  );
};

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
  const [isExporting, setIsExporting] = useState(false);
  const [uploadingConsentFor, setUploadingConsentFor] = useState<string | null>(null);
  const [consentSearchQuery, setConsentSearchQuery] = useState("");
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  // Cache-busting timestamp for redaction images — increment to force reload
  const [redactionTimestamp, setRedactionTimestamp] = useState<number>(Date.now());
  // Manual redact modal state
  const [manualRedactImage, setManualRedactImage] = useState<ImageResponse | null>(null);

  // ML processing progress state
  const [mlProgress, setMlProgress] = useState<{
    progress: number;
    total: number;
    status: string;
    current_image: string | null;
  } | null>(null);

  // Person view modal state
  const [viewingPerson, setViewingPerson] = useState<PersonResponse | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modalImgRef = useRef<HTMLImageElement>(null);

  // Modal states
  const [addConsentOpen, setAddConsentOpen] = useState(false);
  const [addImagesOpen, setAddImagesOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Hidden file input for per-person consent upload
  const consentFileInputRef = useRef<HTMLInputElement>(null);
  const [consentUploadTarget, setConsentUploadTarget] = useState<string | null>(null);

  // Manual Assignment state
  const [knownPersons, setKnownPersons] = useState<KnownPersonResponse[]>([]);
  const [selectedPid, setSelectedPid] = useState<string>("");
  const [isUpdatingPerson, setIsUpdatingPerson] = useState(false);

  // Promote Person state
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [promoteName, setPromoteName] = useState("");
  const [promotePid, setPromotePid] = useState("");
  const [isPromoting, setIsPromoting] = useState(false);

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

        // Fetch known persons for dropdown logic
        try {
          const knownData = await getKnownPersons();
          setKnownPersons(knownData);
        } catch (e) {
          console.error("Failed to fetch known persons", e);
        }

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
    setMlProgress({ progress: 0, total: 0, status: 'pending', current_image: null });
    try {
      const { task_id } = await processProject(id);
      subscribeToProcessProgress(
        id,
        task_id,
        (data) => {
          setMlProgress({
            progress:      data.progress,
            total:         data.total,
            status:        data.status,
            current_image: data.current_image,
          });
        },
        async () => {
          // done
          toast({ title: 'Processing Complete', description: 'Face recognition finished.' });
          setIsProcessing(false);
          setMlProgress(null);
          const personsData = await getPersons(id!);
          setPersons(personsData);
          setRedactionTimestamp(Date.now());
          await refreshProjectData();
        },
        (err) => {
          toast({ title: 'Processing Failed', description: err, variant: 'destructive' });
          setIsProcessing(false);
          setMlProgress(null);
        },
      );
    } catch (error: any) {
      toast({
        title: 'Processing Failed',
        description: error.message || 'Failed to start processing',
        variant: 'destructive',
      });
      setIsProcessing(false);
      setMlProgress(null);
    }
  };


  const handleGenerateExcel = async () => {
    if (!id) return;
    setIsExporting(true);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${id}/export/excel`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to generate Excel file");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Use filename from Content-Disposition if available
      const cd = response.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : `${project?.name ?? "project"}_metadata.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Excel Generated", description: "Download started." });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Could not generate Excel file",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleConsentUpload = async (personId: string, file: File) => {
    if (!id) return;
    setUploadingConsentFor(personId);
    try {
      await uploadPersonConsent(id, personId, file);
      toast({
        title: "Consent Uploaded",
        description: "Consent PDF uploaded and matched successfully.",
      });
      // Refresh persons to show updated consent_status
      const personsData = await getPersons(id);
      setPersons(personsData);
      // Refresh consent forms count
      const forms = await listConsentForms(id);
      setConsentForms(forms);
      // Bump redaction timestamp so Redaction tab reloads images
      setRedactionTimestamp(Date.now());
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload consent PDF",
        variant: "destructive",
      });
    } finally {
      setUploadingConsentFor(null);
      setConsentUploadTarget(null);
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

  const handleAssignPid = async () => {
    if (!viewingPerson || !selectedPid) return;
    const selectedKnown = knownPersons.find(kp => kp.pid === selectedPid);
    if (!selectedKnown) return;
    
    setIsUpdatingPerson(true);
    try {
      await updatePerson(viewingPerson.id, {
        pid: selectedKnown.pid,
        name: selectedKnown.name
      });
      toast({
        title: "Person Assigned",
        description: `Successfully assigned to ${selectedKnown.name}`,
      });
      // Refresh full persons list (includes detections array)
      const personsData = await getPersons(id!);
      setPersons(personsData);

      // Close the modal first — this forces all canvas elements to unmount.
      // Without this, React re-uses the existing mounted <canvas> nodes and
      // onLoad never re-fires, so the combined detections are never drawn.
      setViewingPerson(null);

      // Find the updated person in the fresh list (may have new id if merge happened)
      const refreshedPerson =
        personsData.find(p => p.pid === selectedKnown.pid) ??
        personsData.find(p => p.name === selectedKnown.name);

      // Re-open on next tick so the DOM fully unmounts first
      if (refreshedPerson) {
        await new Promise<void>(r => setTimeout(r, 60));
        setViewingPerson(refreshedPerson);
      }
      await refreshProjectData();
    } catch (e: any) {
      toast({
        title: "Assignment Failed",
        description: e.message || "Could not assign person",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingPerson(false);
      setSelectedPid("");
    }
  };

  const handlePromotePerson = async () => {
    if (!viewingPerson || !promoteName || !promotePid) return;
    setIsPromoting(true);
    try {
      await promotePerson(id!, viewingPerson.id, { name: promoteName, pid: promotePid });
      toast({
        title: "Person Promoted",
        description: `Successfully added ${promoteName} to global dataset.`,
      });
      const personsData = await getPersons(id!);
      setPersons(personsData);
      // Find the newly promoted person by pid to get full detections
      const promoted = personsData.find(p => p.pid === promotePid);
      setViewingPerson(promoted ?? null);
      setPromoteDialogOpen(false);
      setPromoteName("");
      setPromotePid("");
      
      const knownData = await getKnownPersons();
      setKnownPersons(knownData);
    } catch (e: any) {
      toast({
        title: "Promotion Failed",
        description: e.message || "Could not promote person",
        variant: "destructive"
      });
    } finally {
      setIsPromoting(false);
    }
  };

  const handleDeletePerson = async (personId: string, personName: string) => {
    if (!confirm(`Delete "${personName}" from this project? This cannot be undone.`)) return;
    try {
      await deletePerson(personId);
      toast({ title: "Person Deleted", description: `"${personName}" has been removed.` });
      const personsData = await getPersons(id!);
      setPersons(personsData);
    } catch (e: any) {
      toast({
        title: "Delete Failed",
        description: e.message || "Could not delete person",
        variant: "destructive"
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
      
      const personsData = await getPersons(id);
      setPersons(personsData);
    } catch (error: any) {
      console.error("Failed to refresh data:", error);
    }
  };

  const handleDeleteConsent = async (consentId: string) => {
    if (!confirm("Are you sure you want to delete this consent form?")) return;
    try {
      await deleteConsentForm(consentId);
      toast({ title: "Consent form deleted successfully" });
      refreshProjectData();
    } catch (error: any) {
      toast({ 
        title: "Failed to delete consent form", 
        description: error.message || "An error occurred", 
        variant: "destructive" 
      });
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
            <div className="flex flex-col gap-1">
              <Button 
                  variant="outline" 
                  onClick={handleProcessProject}
                  disabled={isProcessing}
              >
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mlProgress?.status === 'saving' ? 'Saving…' : 'Processing…'}
                  </>
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
              </Button>
              {mlProgress && mlProgress.total > 0 && (
                <div className="w-44">
                  <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                    <span className="truncate max-w-[8rem]">{mlProgress.current_image ?? (mlProgress.status === 'saving' ? 'Saving results…' : 'Starting…')}</span>
                    <span>{mlProgress.progress}/{mlProgress.total}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${mlProgress.total ? Math.round((mlProgress.progress / mlProgress.total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleGenerateExcel}
              disabled={isExporting}
              className="gap-2"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Generate Excel
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
            <TabsTrigger value="redaction">Redaction</TabsTrigger>
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
                  <Card key={image.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-square bg-slate-900 flex items-center justify-center overflow-hidden">
                      {image.file_url ? (
                        <img 
                          src={`http://localhost:8000${image.file_url}`}
                          alt={image.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to icon if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<svg class="h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                          }}
                        />
                      ) : (
                        <Image className="h-12 w-12 text-slate-400" />
                      )}
                    </div>
                    <CardContent className="p-3 bg-slate-900">
                      <p className="text-sm font-medium truncate text-white">{image.name}</p>
                      <p className="text-xs text-slate-400">
                        {image.width} x {image.height}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {image.file_size ? `${(image.file_size / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="consent" className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
              <div className="flex items-center gap-4 flex-1">
                <h3 className="text-lg font-medium">Consent Forms</h3>
                {consentForms.length > 0 && (
                  <Input 
                    placeholder="Search forms..." 
                    value={consentSearchQuery} 
                    onChange={(e) => setConsentSearchQuery(e.target.value)}
                    className="max-w-xs h-9"
                  />
                )}
              </div>
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
                {consentForms
                  .filter(form => form.form_name.toLowerCase().includes(consentSearchQuery.toLowerCase()))
                  .map((form) => (
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
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(form.file_url?.startsWith('http') ? form.file_url : `http://localhost:8000${form.file_url}`, '_blank')}
                        >
                          View
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDeleteConsent(form.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="persons" className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
              <div className="flex items-center gap-4 flex-1">
                <h3 className="text-lg font-medium">Detected People</h3>
                {persons.length > 0 && (
                  <Input 
                    placeholder="Search by name or PID..." 
                    value={personSearchQuery} 
                    onChange={(e) => setPersonSearchQuery(e.target.value)}
                    className="max-w-xs h-9"
                  />
                )}
              </div>
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
                    {isProcessing ? (mlProgress?.status === 'saving' ? 'Saving…' : 'Processing…') : 'Process Project'}
                  </Button>
                  {mlProgress && mlProgress.total > 0 && (
                    <div className="mt-2 w-56">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span className="truncate max-w-[11rem]">{mlProgress.current_image ?? (mlProgress.status === 'saving' ? 'Saving results…' : 'Starting…')}</span>
                        <span>{mlProgress.progress}/{mlProgress.total}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${mlProgress.total ? Math.round((mlProgress.progress / mlProgress.total) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
                <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Person ID (pid)</TableHead>
                            <TableHead>Confidence</TableHead>
                            <TableHead>Consent Status</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {persons
                          .filter(person => 
                            (person.name || "").toLowerCase().includes(personSearchQuery.toLowerCase()) ||
                            (person.pid || "").toLowerCase().includes(personSearchQuery.toLowerCase())
                          )
                          .map((person) => {
                          // Find an image associated with this person for the View button
                          const linkedImage = images.find((img) =>
                            person.bbox != null  // person was detected in some image
                          );
                          return (
                            <TableRow key={person.id}>
                                <TableCell className="font-medium">{person.name}</TableCell>
                                <TableCell>
                                    {person.pid ? (
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {person.pid}
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {person.confidence != null ? (
                                        <span className={`text-sm font-medium ${
                                            person.confidence >= 0.7 ? 'text-green-500' :
                                            person.confidence >= 0.55 ? 'text-yellow-500' :
                                            'text-red-400'
                                        }`}>
                                            {(person.confidence * 100).toFixed(1)}%
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge 
                                        variant={
                                            person.consent_status === 'granted' ? 'default' :
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
                                    <div className="flex items-center gap-2">
                                        {/* View button — opens face highlight modal */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              if (person.image_url) {
                                                setViewingPerson(person);
                                              } else {
                                                toast({
                                                  title: "No image available",
                                                  description: "No image found for this person.",
                                                });
                                              }
                                            }}
                                        >
                                            View
                                        </Button>

                                        {/* Upload Consent — only shown when consent is still pending */}
                                        {person.consent_status !== 'granted' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1 text-xs border-amber-500 text-amber-400 hover:bg-amber-500/10"
                                                disabled={uploadingConsentFor === person.id}
                                                onClick={() => {
                                                    setConsentUploadTarget(person.id);
                                                    consentFileInputRef.current?.click();
                                                }}
                                            >
                                                {uploadingConsentFor === person.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Upload className="h-3 w-3" />
                                                )}
                                                {uploadingConsentFor === person.id ? 'Uploading...' : 'Upload Consent'}
                                            </Button>
                                        )}

                                        {/* Delete button — only for unknown persons (no PID assigned) */}
                                        {!person.pid && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
                                                onClick={() => handleDeletePerson(person.id, person.name)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>

                            </TableRow>
                          );
                        })}
                    </TableBody>
                </Table>

                {/* Hidden file input shared by all Upload Consent buttons */}
                <input
                    ref={consentFileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && consentUploadTarget) {
                            await handleConsentUpload(consentUploadTarget, file);
                        }
                        // Reset input so same file can be selected again
                        e.target.value = '';
                    }}
                />
                </div>
            )}
          </TabsContent>

          {/* ── Redaction Tab ────────────────────────────────────────────── */}
          <TabsContent value="redaction" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Redaction Preview</h2>
            <p className="text-sm text-muted-foreground">
              🟢 Green box = consent granted &nbsp;|&nbsp; 🔴 Red + blurred = no consent
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                const url = `http://localhost:8000/api/projects/${id}/redacted-images/zip`;
                window.location.href = url;
              }}
              disabled={images.length === 0}
            >
              <Download className="h-4 w-4" />
              Download ZIP
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setRedactionTimestamp(Date.now())}
            >
              <Loader2 className="h-4 w-4" style={{ animation: 'none' }} />
              Refresh
            </Button>
          </div>
        </div>

            {images.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No images to redact yet. Upload and process images first.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image) => {
                  const redactedUrl = `http://localhost:8000/api/projects/${id}/images/${image.id}/redacted?t=${redactionTimestamp}`;
                  return (
                    <Card
                      key={image.id}
                      className="overflow-hidden hover:shadow-lg transition-shadow group"
                    >
                      <div className="aspect-square bg-slate-900 flex items-center justify-center overflow-hidden relative">
                        <img
                          src={redactedUrl}
                          alt={image.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 cursor-pointer"
                          onClick={() => window.open(redactedUrl, '_blank')}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="flex flex-col items-center gap-2 text-slate-400"><svg class="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span class="text-xs">Not processed</span></div>';
                            }
                          }}
                        />
                        {/* "Run model first" overlay */}
                        {persons.length === 0 && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
                            <span className="text-xs font-semibold text-amber-300 bg-black/60 px-2 py-1 rounded backdrop-blur">
                              ⚠ Run model first
                            </span>
                          </div>
                        )}
                        {/* Draw Regions button overlay */}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="flex items-center gap-1 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white px-2.5 py-1.5 rounded-md shadow-lg transition-colors"
                            onClick={(e) => { e.stopPropagation(); setManualRedactImage(image); }}
                          >
                            ✏️ Draw Regions
                          </button>
                        </div>
                      </div>
                      <CardContent className="p-2 bg-slate-900">
                        <p className="text-xs font-medium truncate text-white">{image.name}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
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

        {/* Manual Redaction Modal */}
        {manualRedactImage && (
          <ManualRedactModal
            open={!!manualRedactImage}
            onOpenChange={(open) => { if (!open) setManualRedactImage(null); }}
            projectId={id!}
            imageId={manualRedactImage.id}
            imageName={manualRedactImage.name}
            imageUrl={
              manualRedactImage.file_url?.startsWith("http")
                ? manualRedactImage.file_url
                : `http://localhost:8000${manualRedactImage.file_url}`
            }
            onSaved={() => setRedactionTimestamp(Date.now())}
          />
        )}

        {/* Person Face Highlight Modal */}
        <Dialog open={!!viewingPerson} onOpenChange={(open) => { if (!open) setViewingPerson(null); }}>
          <DialogContent className="max-w-2xl w-full p-0 overflow-hidden bg-slate-950 border-slate-800">
            <DialogHeader className="px-5 pt-5 pb-3">
              <DialogTitle className="text-white flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-400" />
                {viewingPerson?.name ?? "Person"}
              </DialogTitle>
            </DialogHeader>

            {/* Canvas image area (Horizontal Scroll) */}
            <div className="relative w-full bg-black">
              <div 
                className="flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory" 
                style={{ 
                   scrollBehavior: 'smooth', 
                   scrollbarWidth: 'thin',
                   scrollbarColor: '#475569 #0f172a'
                }}
              >
                {viewingPerson?.detections && viewingPerson.detections.length > 0 ? (
                  viewingPerson.detections.map((det, idx) => (
                    <FaceDetectionCard key={idx} detection={det} person={viewingPerson} />
                  ))
                ) : viewingPerson?.image_url ? (
                  <FaceDetectionCard 
                    detection={{ image_url: viewingPerson.image_url, image_id: viewingPerson.image_id || "", bbox: viewingPerson.bbox || null }} 
                    person={viewingPerson} 
                  />
                ) : (
                  <div className="w-full h-[320px] flex items-center justify-center text-slate-500">
                    No images found for this person
                  </div>
                )}
              </div>
              
              {/* Image index indicator if multiple images */}
              {viewingPerson?.detections && viewingPerson.detections.length > 1 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs font-medium px-4 py-1.5 rounded-full backdrop-blur border border-white/10 shadow-lg flex items-center gap-2 pointer-events-none">
                  <span>{viewingPerson.detections.length} Total Detections</span>
                  <span className="text-white/50">|</span>
                  <span>Scroll right &rarr;</span>
                </div>
              )}
            </div>

            {/* Manual Assignment */}
            <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex flex-col gap-2">
              <label className="text-sm text-slate-400 font-medium">Assign Person ID Manually</label>
              <div className="flex items-center gap-3">
                <Select value={selectedPid} onValueChange={setSelectedPid}>
                  <SelectTrigger className="w-full max-w-sm bg-slate-950 border-slate-700 text-slate-200">
                    <SelectValue placeholder="Select a known person..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-700 max-h-[240px]">
                    {knownPersons.map(kp => (
                      <SelectItem key={kp.pid} value={kp.pid} className="focus:bg-slate-800 focus:text-white text-slate-200 cursor-pointer">
                        {kp.name} ({kp.pid})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAssignPid}
                  disabled={!selectedPid || isUpdatingPerson}
                  className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                >
                  {isUpdatingPerson ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Assign
                </Button>
                
                {/* Promote Button */}
                {viewingPerson?.bbox && (
                  <Button 
                    onClick={() => {
                        const defaultName = viewingPerson.name?.startsWith("Unknown Person") ? "" : viewingPerson.name;
                        setPromoteName(defaultName);
                        setPromotePid("");
                        setPromoteDialogOpen(true);
                    }}
                    variant="outline"
                    className="border-amber-600 text-amber-500 hover:bg-amber-600/10 shrink-0"
                  >
                    Create New Person
                  </Button>
                )}
              </div>
            </div>

            {/* Promote Dialog within the Viewing context */}
            {promoteDialogOpen && (
              <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex flex-col gap-3">
                <p className="text-sm font-medium text-amber-400">Promote to Global Dataset</p>
                <div className="flex gap-2">
                    <Input 
                        placeholder="Name (e.g. Arun Kumar)" 
                        value={promoteName} 
                        onChange={(e) => setPromoteName(e.target.value)} 
                        className="bg-slate-950 border-slate-700 text-white h-9"
                    />
                    <Input 
                        placeholder="PID (e.g. Arun.K)" 
                        value={promotePid} 
                        onChange={(e) => setPromotePid(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-white h-9"
                    />
                    <Button 
                        onClick={handlePromotePerson} 
                        disabled={isPromoting || !promoteName || !promotePid}
                        className="bg-green-600 hover:bg-green-700 text-white shrink-0 h-9 px-4"
                    >
                        {isPromoting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save
                    </Button>
                    <Button variant="ghost" className="text-slate-400 h-9 px-3" onClick={() => setPromoteDialogOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Person metadata strip */}
            <div className="px-5 py-4 bg-slate-900 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-xs uppercase tracking-wide">Name</span>
                <span className="text-white font-medium">{viewingPerson?.name}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-xs uppercase tracking-wide">Person ID</span>
                <span className="text-white font-mono text-xs">{viewingPerson?.pid ?? "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-xs uppercase tracking-wide">Consent Status</span>
                <Badge
                  variant={
                    viewingPerson?.consent_status === "granted" ? "default" :
                    viewingPerson?.consent_status === "denied"  ? "destructive" : "outline"
                  }
                  className={
                    viewingPerson?.consent_status === "granted" ? "bg-green-500 hover:bg-green-600 w-fit" : "w-fit"
                  }
                >
                  {viewingPerson?.consent_status}
                </Badge>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-xs uppercase tracking-wide">Confidence</span>
                <span className={`font-medium ${
                  (viewingPerson?.confidence ?? 0) >= 0.7 ? "text-green-400" :
                  (viewingPerson?.confidence ?? 0) >= 0.55 ? "text-yellow-400" : "text-red-400"
                }`}>
                  {viewingPerson?.confidence != null
                    ? `${(viewingPerson.confidence * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
              {!viewingPerson?.bbox && (
                <div className="col-span-2 text-slate-500 text-xs italic mt-1">
                  ⚠ Face location data not available — showing full image.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminProjectDetails;
