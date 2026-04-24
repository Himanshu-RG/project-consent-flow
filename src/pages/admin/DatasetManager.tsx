import { useState, useEffect, useRef, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  UploadCloud,
  Loader2,
  Database,
  UserCheck,
  User,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { getKnownPersons, uploadKnownPerson, deleteKnownPerson } from "@/lib/api/persons";
import type { KnownPersonResponse } from "@/lib/api-types";

// ── bulk upload queue types ───────────────────────────────────────────────────
type FileStatus = "pending" | "uploading" | "done" | "updated" | "error";

interface FileEntry {
  file: File;
  name: string;
  pid: string;
  status: FileStatus;
  message?: string;
}

function stemOf(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "");
}

const StatusIcon = ({ status }: { status: FileStatus }) => {
  if (status === "done")    return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === "updated") return <RefreshCw    className="h-4 w-4 text-blue-400 shrink-0" />;
  if (status === "error")   return <XCircle      className="h-4 w-4 text-red-400 shrink-0" />;
  if (status === "uploading") return <Loader2   className="h-4 w-4 animate-spin text-blue-400 shrink-0" />;
  return                           <Clock        className="h-4 w-4 text-slate-500 shrink-0" />;
};

// ── Main component ────────────────────────────────────────────────────────────
const DatasetManager = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [persons, setPersons] = useState<KnownPersonResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingPid, setDeletingPid] = useState<string | null>(null);

  // ── Single upload state ───────────────────────────────────────────────
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singleName, setSingleName] = useState("");
  const [singlePid, setSinglePid] = useState("");
  const [isSingleUploading, setIsSingleUploading] = useState(false);
  const singleInputRef = useRef<HTMLInputElement>(null);

  // ── Bulk upload state ─────────────────────────────────────────────────
  const [queue, setQueue] = useState<FileEntry[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────
  const fetchPersons = useCallback(async () => {
    setIsLoading(true);
    try {
      setPersons(await getKnownPersons());
    } catch (e: any) {
      toast({ title: "Failed to load dataset", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchPersons(); }, [fetchPersons]);

  // ── Single upload handlers ────────────────────────────────────────────
  const handleSingleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    setSingleFile(file);
    if (!singleName && !singlePid) {
      const stem = stemOf(file.name);
      setSingleName(stem);
      setSinglePid(stem);
    }
  };

  const handleSingleUpload = async () => {
    if (!singleFile || !singleName || !singlePid) return;
    setIsSingleUploading(true);
    try {
      const res: any = await uploadKnownPerson(singleName, singlePid, singleFile);
      const isUpdate = res?.updated === true;
      toast({
        title: isUpdate ? "Embedding Updated" : "Person Added",
        description: isUpdate
          ? `A new photo of ${singleName} was averaged into their embedding — recognition improved.`
          : `${singleName} added to the dataset.`,
      });
      setSingleFile(null);
      setSingleName("");
      setSinglePid("");
      if (singleInputRef.current) singleInputRef.current.value = "";
      await fetchPersons();
    } catch (e: any) {
      toast({ title: "Upload Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSingleUploading(false);
    }
  };

  // ── Bulk upload handlers ──────────────────────────────────────────────
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleBulkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const addFiles = (files: File[]) => {
    const imgFiles = files.filter(f => f.type.startsWith("image/"));
    if (!imgFiles.length) {
      toast({ title: "No images selected", description: "Select .jpg, .png, or similar image files.", variant: "destructive" });
      return;
    }
    setQueue(imgFiles.map(f => ({ file: f, name: stemOf(f.name), pid: stemOf(f.name), status: "pending" })));
  };

  const handleBulkUpload = async () => {
    if (!queue.length) return;
    setIsBulkUploading(true);
    const updated = [...queue];
    let anySuccess = false;

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === "done" || updated[i].status === "updated") continue;
      updated[i] = { ...updated[i], status: "uploading" };
      setQueue([...updated]);

      try {
        const res: any = await uploadKnownPerson(updated[i].name, updated[i].pid, updated[i].file);
        updated[i] = {
          ...updated[i],
          status: res?.updated ? "updated" : "done",
          message: res?.message,
        };
        anySuccess = true;
      } catch (e: any) {
        updated[i] = { ...updated[i], status: "error", message: e?.message ?? "Upload failed" };
      }
      setQueue([...updated]);
    }

    setIsBulkUploading(false);
    if (anySuccess) {
      await fetchPersons();
      toast({ title: "Bulk upload complete", description: "Dataset has been updated." });
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDelete = async (pid: string, name: string) => {
    if (!confirm(`Remove "${name}" (${pid}) from the dataset? This cannot be undone.`)) return;
    setDeletingPid(pid);
    try {
      await deleteKnownPerson(pid);
      setPersons(prev => prev.filter(p => p.pid !== pid));
      toast({ title: "Deleted", description: `"${name}" removed from dataset.` });
    } catch (e: any) {
      toast({ title: "Delete Failed", description: e.message, variant: "destructive" });
    } finally {
      setDeletingPid(null);
    }
  };

  const pendingCount = queue.filter(e => e.status === "pending" || e.status === "error").length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in-0 duration-300">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dataset Manager</h1>
          <p className="text-sm text-muted-foreground">
            Manage known persons for facial recognition. Upload multiple photos of the same person to improve accuracy.
          </p>
        </div>

        {/* ── Upload Card with tabs ──────────────────────────────────────── */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-400" />
              Upload Reference Photos
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              💡 Uploading <strong>2–5 different photos</strong> of the same person (different angles, lighting) significantly improves recognition accuracy. Duplicate uploads automatically average embeddings — no data is lost.
            </p>

            <Tabs defaultValue="single">
              <TabsList className="bg-slate-800 mb-4">
                <TabsTrigger value="single" className="data-[state=active]:bg-slate-700">Single Image</TabsTrigger>
                <TabsTrigger value="bulk"   className="data-[state=active]:bg-slate-700">Bulk Upload</TabsTrigger>
              </TabsList>

              {/* ── Single Upload ─────────────────────────── */}
              <TabsContent value="single">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Drop/click zone */}
                  <div
                    className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors hover:bg-slate-800 border-slate-700"
                    onClick={() => singleInputRef.current?.click()}
                  >
                    <input
                      ref={singleInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleSingleFile(e.target.files[0]); e.target.value = ""; }}
                    />
                    {singleFile ? (
                      <div className="text-blue-400 font-medium text-sm break-all">{singleFile.name}</div>
                    ) : (
                      <>
                        <UploadCloud className="h-10 w-10 text-slate-400 mb-2" />
                        <p className="text-sm font-medium text-slate-300">Click to select a portrait image</p>
                        <p className="text-xs text-slate-500 mt-1">.jpg, .png, .webp</p>
                      </>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-1.5 block">Person Name</label>
                      <Input
                        placeholder="e.g. Arun Kumar"
                        value={singleName}
                        onChange={e => setSingleName(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-300 mb-1.5 block">Person ID (PID)</label>
                      <Input
                        placeholder="e.g. Arun.K"
                        value={singlePid}
                        onChange={e => setSinglePid(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <Button
                      onClick={handleSingleUpload}
                      disabled={isSingleUploading || !singleFile || !singleName || !singlePid}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isSingleUploading
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
                        : <><Database className="mr-2 h-4 w-4" />Inject into Dataset</>}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* ── Bulk Upload ───────────────────────────── */}
              <TabsContent value="bulk">
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">
                    Each filename stem becomes both the <strong>Name</strong> and <strong>PID</strong>.
                    &nbsp;Example: <code className="bg-slate-800 px-1 rounded">Arun.A.jpg</code> → PID: <em>Arun.A</em>
                  </p>

                  {/* Drop zone */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors select-none
                      ${dragActive ? "border-blue-500 bg-blue-500/10" : "border-slate-700 hover:bg-slate-800"}`}
                    onDragEnter={handleDrag} onDragLeave={handleDrag}
                    onDragOver={handleDrag}  onDrop={handleDrop}
                    onClick={() => bulkInputRef.current?.click()}
                  >
                    <input ref={bulkInputRef} type="file" accept="image/*" multiple onChange={handleBulkChange} className="hidden" />
                    <UploadCloud className="h-10 w-10 text-slate-500 mb-3" />
                    <p className="text-sm font-medium text-slate-300">Drag &amp; drop multiple images, or click to browse</p>
                    <p className="text-xs text-slate-500 mt-1">Supports .jpg, .jpeg, .png, .webp</p>
                  </div>

                  {/* Queue list */}
                  {queue.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>{queue.length} file{queue.length !== 1 ? "s" : ""} queued</span>
                        <span className="text-green-400">✓ {queue.filter(e => e.status === "done" || e.status === "updated").length} done</span>
                        <span className="text-red-400">✗ {queue.filter(e => e.status === "error").length} failed</span>
                        {!isBulkUploading && (
                          <button onClick={() => setQueue([])} className="ml-auto text-slate-500 hover:text-slate-300 underline">Clear</button>
                        )}
                      </div>

                      <div className="max-h-52 overflow-y-auto space-y-1 pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#475569 #0f172a" }}>
                        {queue.map((entry, i) => (
                          <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded text-xs border
                            ${entry.status === "done"      ? "bg-green-950/40 border-green-900/40" :
                              entry.status === "updated"   ? "bg-blue-950/40 border-blue-900/40" :
                              entry.status === "error"     ? "bg-red-950/40 border-red-900/40" :
                              entry.status === "uploading" ? "bg-blue-950/40 border-blue-900/40" :
                                                             "bg-slate-800/60 border-slate-700/40"}`}>
                            <StatusIcon status={entry.status} />
                            <span className="flex-1 font-mono truncate text-slate-300">{entry.file.name}</span>
                            <span className="text-slate-500 shrink-0">PID: <span className="text-slate-300">{entry.pid}</span></span>
                            {entry.message && entry.status === "error" && (
                              <span className="text-red-400 shrink-0 ml-1">{entry.message}</span>
                            )}
                            {entry.status === "updated" && (
                              <span className="text-blue-400 shrink-0 ml-1">embedding updated</span>
                            )}
                          </div>
                        ))}
                      </div>

                      <Button
                        onClick={handleBulkUpload}
                        disabled={isBulkUploading || pendingCount === 0}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isBulkUploading
                          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
                          : <><Database className="mr-2 h-4 w-4" />Inject {pendingCount} image{pendingCount !== 1 ? "s" : ""} into Dataset</>}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Known Persons Grid ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-foreground">Known Persons Dataset</h2>
            <span className="text-sm text-muted-foreground ml-auto bg-slate-800 px-2 py-1 rounded-full">
              {persons.length} records
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : persons.length === 0 ? (
            <Card className="border-dashed border-2 bg-transparent">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Database className="w-12 h-12 mb-4 opacity-50" />
                <p>No persons in dataset yet. Upload reference photos above to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {persons.map(kp => (
                <Card key={kp.pid} className="overflow-hidden bg-slate-900 border-slate-800 hover:border-slate-600 hover:shadow-lg transition-all group">
                  <div className="aspect-square bg-slate-950 relative flex items-center justify-center">
                    {kp.image_url ? (
                      <img
                        src={`http://localhost:8000${kp.image_url}`}
                        alt={kp.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const p = e.currentTarget.parentElement;
                          if (p) p.innerHTML = '<div class="absolute inset-0 flex items-center justify-center bg-slate-950"><svg class="w-12 h-12 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></div>';
                        }}
                      />
                    ) : (
                      <User className="w-12 h-12 text-slate-800" />
                    )}

                    {/* Delete overlay — ADMIN ONLY */}
                    {isAdmin && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          disabled={deletingPid === kp.pid}
                          onClick={(e) => { e.stopPropagation(); handleDelete(kp.pid, kp.name); }}
                        >
                          {deletingPid === kp.pid
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Trash2  className="h-3 w-3" />}
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3 text-center border-t border-slate-800">
                    <p className="font-semibold text-white text-sm truncate" title={kp.name}>{kp.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate" title={kp.pid}>{kp.pid}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default DatasetManager;
