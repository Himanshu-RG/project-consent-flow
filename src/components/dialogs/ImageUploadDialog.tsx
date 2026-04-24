import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Loader2, CheckCircle2 } from "lucide-react";

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUploadComplete: () => void;
}

/** Send one batch of files via XHR so we get real upload-progress events. */
function xhrUploadBatch(
  projectId: string,
  files: File[],
  meta: { batch_number?: string; camera_type?: string; factor?: string },
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    if (meta.batch_number) fd.append("batch_number", meta.batch_number);
    if (meta.camera_type)  fd.append("camera_type",  meta.camera_type);
    if (meta.factor)       fd.append("factor",        meta.factor);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `http://localhost:8000/api/projects/${projectId}/images`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.detail || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error — upload failed"));
    xhr.send(fd);
  });
}

export const ImageUploadDialog = ({ open, onOpenChange, projectId, onUploadComplete }: ImageUploadDialogProps) => {
  const [files, setFiles]               = useState<File[]>([]);
  const [batchNumber, setBatchNumber]   = useState("");
  const [cameraType, setCameraType]     = useState<"dslr" | "mobile" | "other">("dslr");
  const [isUploading, setIsUploading]   = useState(false);
  const [uploadPct, setUploadPct]       = useState(0);       // 0–100 overall
  const [uploadDone, setUploadDone]     = useState(false);
  const [statusMsg, setStatusMsg]       = useState("");
  const { toast }                        = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...dropped]);
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({ title: "No Files Selected", description: "Select at least one image.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadPct(0);
    setUploadDone(false);

    // Send up to 20 images per request (was 5 — reduces HTTP round-trips 4×)
    const CHUNK = 20;
    const chunks: File[][] = [];
    for (let i = 0; i < files.length; i += CHUNK) chunks.push(files.slice(i, i + CHUNK));

    let totalUploaded = 0;

    try {
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        const chunkLabel = chunks.length > 1
          ? `batch ${ci + 1}/${chunks.length} (${chunk.length} files)`
          : `${chunk.length} file${chunk.length !== 1 ? "s" : ""}`;
        setStatusMsg(`Uploading ${chunkLabel}…`);

        // Within-chunk XHR progress maps to the chunk's share of the total
        await xhrUploadBatch(
          projectId,
          chunk,
          { batch_number: batchNumber || undefined, camera_type: cameraType },
          (chunkPct) => {
            const globalPct = Math.round(
              ((totalUploaded + (chunk.length * chunkPct) / 100) / files.length) * 100
            );
            setUploadPct(globalPct);
          },
        );

        totalUploaded += chunk.length;
        setUploadPct(Math.round((totalUploaded / files.length) * 100));
      }

      setUploadPct(100);
      setUploadDone(true);
      setStatusMsg(`${files.length} image${files.length !== 1 ? "s" : ""} uploaded successfully`);

      toast({ title: "Upload Complete", description: `${files.length} image(s) uploaded.` });

      setTimeout(() => {
        setFiles([]);
        setBatchNumber("");
        setUploadPct(0);
        setUploadDone(false);
        setStatusMsg("");
        onUploadComplete();
        onOpenChange(false);
      }, 900);

    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message || "Failed to upload images", variant: "destructive" });
      setStatusMsg("");
      setUploadPct(0);
    } finally {
      setIsUploading(false);
    }
  };

  // Total size helper
  const totalMB = (files.reduce((s, f) => s + f.size, 0) / (1024 * 1024)).toFixed(1);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isUploading) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Images</DialogTitle>
          <DialogDescription>
            Supported formats: JPG, PNG, BMP · Max 10 MB per file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
            onClick={() => !isUploading && document.getElementById("image-file-input")?.click()}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-1">
              Drag &amp; drop images here, or <span className="text-primary underline">browse</span>
            </p>
            <p className="text-xs text-muted-foreground">Tip: you can select hundreds of files at once</p>
            <input
              id="image-file-input"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Selected: <span className="font-semibold">{files.length} files</span>{" "}
                  <span className="text-muted-foreground text-xs">({totalMB} MB total)</span>
                </Label>
                {!isUploading && (
                  <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
                    Clear all
                  </Button>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded border p-2 bg-muted/30">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-sm py-0.5">
                    <span className="truncate flex-1 text-xs">{file.name}</span>
                    <span className="text-xs text-muted-foreground mx-2 shrink-0">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                    {!isUploading && (
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFile(index)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="batch-number">Batch Number (optional)</Label>
              <Input
                id="batch-number"
                placeholder="e.g. BATCH-001"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                disabled={isUploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="camera-type">Camera Type</Label>
              <Select value={cameraType} onValueChange={(v: any) => setCameraType(v)} disabled={isUploading}>
                <SelectTrigger id="camera-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dslr">DSLR</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{statusMsg}</span>
                <span>{uploadPct}%</span>
              </div>
              <Progress value={uploadPct} className="h-2" />
            </div>
          )}

          {uploadDone && (
            <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              {statusMsg}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || files.length === 0}>
            {isUploading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
              : `Upload${files.length > 0 ? ` (${files.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
