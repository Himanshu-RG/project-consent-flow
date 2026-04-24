/**
 * ManualRedactModal
 * -----------------
 * Lets users draw bounding boxes on an image to manually mark:
 *   🔴 Red  → not consented → blurred + REDACTED label
 *   🟢 Green → consented    → named green box (requires PDF upload)
 *
 * Boxes are sent to POST /projects/{pid}/images/{iid}/manual-redact-upload
 * as multipart/form-data with boxes JSON + optional pdf_{i} files.
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Upload, PenLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { saveManualRedactBoxes, getManualRedactBoxes } from "@/lib/api/images";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ManualBox {
  id: string;
  x: number;           // pixel coords on the ORIGINAL image
  y: number;
  width: number;
  height: number;
  consented: boolean;  // true → green, false → red/blurred
  label: string;
  pdf?: File | null;
  pdfName?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  imageId: string;
  imageName: string;
  imageUrl: string;    // original (non-redacted) image URL
  onSaved: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2);

const COLOR_RED        = "rgba(220,38,38,0.9)";
const COLOR_GREEN      = "rgba(34,197,94,0.9)";
const COLOR_RED_FILL   = "rgba(220,38,38,0.2)";
const COLOR_GREEN_FILL = "rgba(34,197,94,0.2)";

// Max canvas dimensions — keeps the modal a reasonable size
const MAX_W = 700;
const MAX_H = 520;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const ManualRedactModal: React.FC<Props> = ({
  open,
  onOpenChange,
  projectId,
  imageId,
  imageName,
  imageUrl,
  onSaved,
}) => {
  const { toast } = useToast();

  const canvasRef  = useRef<HTMLCanvasElement>(null);   // image background
  const overlayRef = useRef<HTMLCanvasElement>(null);   // drawing layer
  const imgRef     = useRef<HTMLImageElement | null>(null);

  const [boxes, setBoxes]         = useState<ManualBox[]>([]);
  const [mode, setMode]           = useState<"red" | "green">("red");
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent]     = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isSaving, setIsSaving]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [scale, setScale]         = useState(1);   // canvas-px → original-image-px

  // Green-box pending form
  const [pendingBox, setPendingBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [greenLabel, setGreenLabel] = useState("");
  const [greenPdf, setGreenPdf]     = useState<File | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // ── Draw all saved boxes on the overlay canvas ──────────────────────────────

  const drawAllBoxes = useCallback((boxList: ManualBox[], currentScale = scale) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    boxList.forEach((b) => {
      const cx = b.x / currentScale;
      const cy = b.y / currentScale;
      const cw = b.width  / currentScale;
      const ch = b.height / currentScale;

      const stroke = b.consented ? COLOR_GREEN : COLOR_RED;
      const fill   = b.consented ? COLOR_GREEN_FILL : COLOR_RED_FILL;

      ctx.fillStyle = fill;
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cx, cy, cw, ch);

      // Label pill above the box
      const label = b.consented ? (b.label || "Consented") : "REDACTED";
      ctx.font = "bold 12px sans-serif";
      const tw = ctx.measureText(label).width;
      const lx = cx;
      const ly = cy > 22 ? cy - 20 : cy + ch + 4;
      ctx.fillStyle = stroke;
      ctx.fillRect(lx, ly, tw + 12, 18);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, lx + 6, ly + 13);
    });
  }, [scale]);

  // ── Load the image + draw it onto the canvas ─────────────────────────────────
  // We use a 100 ms delay so the Dialog has time to fully mount its DOM
  // before we try to access canvas refs. Without this, the refs are null.

  const loadImage = useCallback(() => {
    setIsLoading(true);
    setLoadError(false);

    const img = new Image();
    // ⚠️  Do NOT set crossOrigin here — the backend doesn't send CORS headers
    //     on image file responses, which causes the browser to block the load.
    img.src = imageUrl;

    img.onload = async () => {
      imgRef.current = img;

      const canvas  = canvasRef.current;
      const overlay = overlayRef.current;

      if (!canvas || !overlay) {
        // Refs still not ready — shouldn't happen at 100 ms but handle gracefully
        setLoadError(true);
        setIsLoading(false);
        return;
      }

      // Scale image to fit inside MAX_W × MAX_H, keeping aspect ratio
      const ratio = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight, 1);
      const cw = Math.round(img.naturalWidth  * ratio);
      const ch = Math.round(img.naturalHeight * ratio);

      canvas.width  = cw;
      canvas.height = ch;
      overlay.width  = cw;
      overlay.height = ch;

      const newScale = 1 / ratio;   // canvas-px → image-px multiplier
      setScale(newScale);

      // Paint the image
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0, cw, ch);

      // Fetch any previously saved boxes
      try {
        const existing = await getManualRedactBoxes(projectId, imageId);
        setBoxes(existing);
        drawAllBoxes(existing, newScale);
      } catch {
        /* no boxes yet — fine */
      }

      setIsLoading(false);
    };

    img.onerror = () => {
      setLoadError(true);
      setIsLoading(false);
    };
  }, [imageUrl, projectId, imageId, drawAllBoxes]);

  // Trigger load with a small delay each time the modal opens
  useEffect(() => {
    if (!open) {
      // Reset state when closing
      setBoxes([]);
      setPendingBox(null);
      setGreenLabel("");
      setGreenPdf(null);
      setCurrent(null);
      setLoadError(false);
      return;
    }

    // Small delay to let the Dialog's DOM (canvas elements) mount first
    const timer = setTimeout(loadImage, 120);
    return () => clearTimeout(timer);
  }, [open, loadImage]);

  // Re-paint saved boxes when the list changes (e.g. after delete)
  useEffect(() => {
    drawAllBoxes(boxes);
  }, [boxes, drawAllBoxes]);

  // ── Mouse / drawing logic ────────────────────────────────────────────────────

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (pendingBox) return;
    setDragStart(getPos(e));
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !dragStart) return;
    const pos = getPos(e);
    const rect = {
      x: Math.min(pos.x, dragStart.x),
      y: Math.min(pos.y, dragStart.y),
      w: Math.abs(pos.x - dragStart.x),
      h: Math.abs(pos.y - dragStart.y),
    };
    setCurrent(rect);

    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    drawAllBoxes(boxes);

    const stroke = mode === "green" ? COLOR_GREEN : COLOR_RED;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([]);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !dragStart || !current) {
      setIsDrawing(false);
      return;
    }
    setIsDrawing(false);

    const imgBox = {
      x: Math.round(current.x * scale),
      y: Math.round(current.y * scale),
      w: Math.round(current.w * scale),
      h: Math.round(current.h * scale),
    };

    if (imgBox.w < 8 || imgBox.h < 8) { setCurrent(null); return; }

    if (mode === "red") {
      setBoxes((prev) => [
        ...prev,
        { id: uid(), x: imgBox.x, y: imgBox.y, width: imgBox.w, height: imgBox.h, consented: false, label: "REDACTED" },
      ]);
    } else {
      setPendingBox(imgBox);
      setGreenLabel("");
      setGreenPdf(null);
    }
    setCurrent(null);
  };

  const commitGreenBox = () => {
    if (!pendingBox || !greenLabel.trim()) return;
    setBoxes((prev) => [
      ...prev,
      { id: uid(), x: pendingBox.x, y: pendingBox.y, width: pendingBox.w, height: pendingBox.h, consented: true, label: greenLabel.trim(), pdf: greenPdf },
    ]);
    setPendingBox(null);
    setGreenLabel("");
    setGreenPdf(null);
  };

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveManualRedactBoxes(projectId, imageId, boxes);
      toast({ title: "Saved", description: `Manual regions saved for ${imageName}` });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save Failed", description: e.message || "Could not save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden bg-slate-950 border-slate-800">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-800">
          <DialogTitle className="text-white flex items-center gap-2">
            <PenLine className="h-5 w-5 text-violet-400" />
            Manual Redaction — {imageName}
          </DialogTitle>
        </DialogHeader>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-3 px-5 py-3 bg-slate-900 border-b border-slate-800 flex-wrap">
          <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Draw Mode</span>
          <button
            onClick={() => setMode("red")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === "red"
                ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block" />
            Red (Blur / Redact)
          </button>
          <button
            onClick={() => setMode("green")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              mode === "green"
                ? "bg-green-600 text-white shadow-lg shadow-green-900/40"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-green-300 inline-block" />
            Green (Consented)
          </button>
          <span className="text-xs text-slate-500 ml-auto">
            Click &amp; drag on the image to draw a region
          </span>
        </div>

        {/* ── Body ── */}
        <div className="flex" style={{ maxHeight: "68vh" }}>

          {/* Canvas area */}
          <div className="relative flex-1 overflow-auto bg-black flex items-start justify-center min-h-[300px]">

            {/* Loading spinner */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                  <span className="text-xs text-slate-400">Loading image…</span>
                </div>
              </div>
            )}

            {/* Error state */}
            {loadError && !isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 z-10">
                <span className="text-3xl">⚠️</span>
                <p className="text-sm font-medium">Image could not be loaded</p>
                <button
                  onClick={loadImage}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Canvas stack */}
            <div className="relative inline-block">
              {/* Background — the actual image */}
              <canvas ref={canvasRef} className="block" />
              {/* Overlay — drawing layer */}
              <canvas
                ref={overlayRef}
                className="absolute top-0 left-0 cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  if (isDrawing) {
                    setIsDrawing(false);
                    setCurrent(null);
                    drawAllBoxes(boxes);
                  }
                }}
              />
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="w-64 flex-none border-l border-slate-800 bg-slate-950 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">
                Drawn Regions ({boxes.length})
              </p>

              {boxes.length === 0 && (
                <p className="text-xs text-slate-600 italic">No regions yet. Draw on the image.</p>
              )}

              {boxes.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 bg-slate-900 rounded-md px-2 py-1.5 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full flex-none ${b.consented ? "bg-green-500" : "bg-red-500"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {b.consented ? (b.label || "Consented") : "REDACTED"}
                      </p>
                      {b.pdfName && <p className="text-[10px] text-slate-500 truncate">{b.pdfName}</p>}
                      {b.pdf     && <p className="text-[10px] text-green-500 truncate">{b.pdf.name}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => setBoxes((prev) => prev.filter((x) => x.id !== b.id))}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all flex-none"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Pending green-box form */}
            {pendingBox && (
              <div className="border-t border-slate-800 bg-slate-900 p-3 space-y-2">
                <p className="text-xs font-semibold text-green-400">🟢 Consented Person</p>
                <Input
                  placeholder="Person name"
                  value={greenLabel}
                  onChange={(e) => setGreenLabel(e.target.value)}
                  className="h-8 text-xs bg-slate-950 border-slate-700 text-white"
                  onKeyDown={(e) => e.key === "Enter" && commitGreenBox()}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => setGreenPdf(e.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => pdfInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs text-amber-400 border border-amber-600 rounded px-2 py-1 hover:bg-amber-600/10 transition-colors truncate max-w-full"
                  >
                    <Upload className="h-3 w-3 flex-none" />
                    <span className="truncate">{greenPdf ? greenPdf.name : "Upload consent PDF"}</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={commitGreenBox}
                    disabled={!greenLabel.trim()}
                  >
                    Add Box
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-slate-400"
                    onClick={() => { setPendingBox(null); drawAllBoxes(boxes); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            {boxes.filter((b) => !b.consented).length} red ·{" "}
            {boxes.filter((b) => b.consented).length} green
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" className="text-slate-400 text-sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white text-sm gap-2"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Regions
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
