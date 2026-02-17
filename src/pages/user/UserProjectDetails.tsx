import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sampleProjects } from "@/data/sampleData";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, FileText, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const UserProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const project = sampleProjects.find((p) => p.id === id);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);

  if (!project) {
    return (
      <AppLayout><p className="py-12 text-center text-muted-foreground">Project not found.</p></AppLayout>
    );
  }

  const myImages = project.images.filter((i) => i.uploadedBy === user?.username);
  const myPdfs = project.pdfs.filter((p) => p.uploadedBy === user?.username);

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in-0 duration-300">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="capitalize">{project.status}</Badge>
            <span>Enrolled since: {project.createdAt}</span>
          </div>
        </div>

        {/* My Images */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><ImageIcon className="h-5 w-5" /> My Images</CardTitle>
          </CardHeader>
          <CardContent>
            {myImages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No images uploaded.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {myImages.map((img) => (
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
            )}
          </CardContent>
        </Card>

        {/* My PDFs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5" /> My Consent PDFs</CardTitle>
          </CardHeader>
          <CardContent>
            {myPdfs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No PDFs uploaded.</p>
            ) : (
              <div className="space-y-2">
                {myPdfs.map((pdf) => (
                  <div key={pdf.id} className="flex items-center justify-between rounded-md border border-border p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium">{pdf.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setPdfPreview(pdf.name)}>Preview</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lightbox */}
        <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-2xl">
            <DialogTitle className="sr-only">Image Preview</DialogTitle>
            {lightbox && <img src={lightbox} alt="Preview" className="w-full rounded-md" />}
          </DialogContent>
        </Dialog>

        {/* PDF Preview */}
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

export default UserProjectDetails;
