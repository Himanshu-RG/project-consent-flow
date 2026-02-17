import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sampleProjects } from "@/data/sampleData";
import {
  ArrowLeft, Pencil, Trash2, Download, Image as ImageIcon, FileText, BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const AdminProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const project = sampleProjects.find((p) => p.id === id);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);

  if (!project) {
    return (
      <AppLayout>
        <p className="text-center py-12 text-muted-foreground">Project not found.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in-0 duration-300">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="capitalize">{project.status}</Badge>
              <span>Created: {project.createdAt}</span>
              <span>Updated: {project.updatedAt}</span>
              <span>{project.participantCount} participants</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${id}/edit`)}>
              <Pencil className="mr-1 h-4 w-4" /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => {
              toast({ title: "Deleted", description: "Project deleted." });
              navigate("/dashboard");
            }}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="images">
          <TabsList>
            <TabsTrigger value="images" className="gap-1"><ImageIcon className="h-4 w-4" /> Images</TabsTrigger>
            <TabsTrigger value="pdfs" className="gap-1"><FileText className="h-4 w-4" /> Consent PDFs</TabsTrigger>
            <TabsTrigger value="results" className="gap-1"><BarChart3 className="h-4 w-4" /> Model Results</TabsTrigger>
          </TabsList>

          <TabsContent value="images">
            <Card>
              <CardHeader><CardTitle className="text-lg">Uploaded Images</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {project.images.map((img) => (
                    <button
                      key={img.id}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted transition-all hover:ring-2 hover:ring-primary"
                      onClick={() => setLightbox(img.url)}
                    >
                      <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-foreground/60 px-2 py-1 text-xs text-background truncate">
                        {img.name}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pdfs">
            <Card>
              <CardHeader><CardTitle className="text-lg">Consent PDFs</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {project.pdfs.map((pdf) => (
                    <div key={pdf.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm font-medium">{pdf.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setPdfPreview(pdf.name)}>Preview</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Model Results</CardTitle>
                <Button variant="outline" size="sm" onClick={() =>
                  toast({ title: "Generate Excel", description: "Will connect to ML pipeline later." })
                }>
                  <Download className="mr-1 h-4 w-4" /> Generate Excel
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead>PDF</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.modelResults.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.participantName}</TableCell>
                        <TableCell>{r.imageId}</TableCell>
                        <TableCell>{r.pdfId || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "match" ? "default" : r.status === "no-match" ? "destructive" : "secondary"} className="capitalize">
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Image Lightbox */}
        <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-2xl">
            <DialogTitle className="sr-only">Image Preview</DialogTitle>
            {lightbox && <img src={lightbox} alt="Preview" className="w-full rounded-md" />}
          </DialogContent>
        </Dialog>

        {/* PDF Preview Modal */}
        <Dialog open={!!pdfPreview} onOpenChange={() => setPdfPreview(null)}>
          <DialogContent>
            <DialogTitle>PDF Preview</DialogTitle>
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="mb-4 h-16 w-16" />
              <p className="text-sm font-medium">{pdfPreview}</p>
              <p className="mt-2 text-xs">PDF preview will be available when connected to storage.</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminProjectDetails;
