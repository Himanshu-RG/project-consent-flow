import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Loader2, FileText } from "lucide-react";
import { uploadConsentForm } from "@/lib/api/consent";

interface ConsentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUploadComplete: () => void;
}

export const ConsentUploadDialog = ({ open, onOpenChange, projectId, onUploadComplete }: ConsentUploadDialogProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [formName, setFormName] = useState("Consent Form");
  const [signedDate, setSignedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter((file) =>
        file.type === "application/pdf"
      );
      if (newFiles.length !== e.target.files.length) {
        toast({
          title: "Invalid Files",
          description: "Only PDF files are allowed for consent forms",
          variant: "destructive",
        });
      }
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type === "application/pdf"
      );
      if (newFiles.length !== e.dataTransfer.files.length) {
        toast({
          title: "Invalid Files",
          description: "Only PDF files are allowed for consent forms",
          variant: "destructive",
        });
      }
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one PDF to upload",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);

      // Upload each file individually
      for (const file of files) {
        await uploadConsentForm(projectId, file, {
          form_name: formName,
          signed_date: signedDate || undefined,
          expiry_date: expiryDate || undefined,
        });
      }

      toast({
        title: "Upload Successful",
        description: `${files.length} consent form(s) uploaded successfully`,
      });

      // Reset form
      setFiles([]);
      setFormName("Consent Form");
      setSignedDate("");
      setExpiryDate("");
      onUploadComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload consent forms",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Consent Forms</DialogTitle>
          <DialogDescription>
            Upload one or more consent form PDFs to this project
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drag and Drop Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById("pdf-file-input")?.click()}
          >
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop PDF files here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Maximum file size: 10MB per PDF
            </p>
            <input
              id="pdf-file-input"
              type="file"
              multiple
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({files.length})</Label>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground mx-2">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-name">Form Name</Label>
              <Input
                id="form-name"
                placeholder="e.g., Photography Consent Form"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signed-date">Signed Date (Optional)</Label>
                <Input
                  id="signed-date"
                  type="date"
                  value={signedDate}
                  onChange={(e) => setSignedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry-date">Expiry Date (Optional)</Label>
                <Input
                  id="expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || files.length === 0}>
            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload {files.length > 0 && `(${files.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
