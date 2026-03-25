import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { getEnrollmentStatus, uploadPersonConsent } from "@/lib/api/enrollments";
import { CheckCircle2, XCircle, Clock, Upload, Loader2, Download } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ConsentStatusTableProps {
  projectId: string;
  refreshTrigger?: number;
}

interface EnrollmentStatus {
  user_id: string;
  user_name: string;
  user_email: string;
  pid: string | null;
  is_detected: boolean;
  consent_status: "matching" | "not_matching" | "pending";
  match_confidence: number | null;
  person_id: string | null;
  has_identity_image: boolean;
  has_consent_pdf: boolean;
}

export const ConsentStatusTable = ({ projectId, refreshTrigger }: ConsentStatusTableProps) => {
  const { toast } = useToast();
  const [enrollmentStatuses, setEnrollmentStatuses] = useState<EnrollmentStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingPersonId, setUploadingPersonId] = useState<string | null>(null);

  useEffect(() => {
    loadEnrollmentStatus();
  }, [projectId, refreshTrigger]);

  const loadEnrollmentStatus = async () => {
    try {
      setIsLoading(true);
      const statuses = await getEnrollmentStatus(projectId);
      setEnrollmentStatuses(statuses);
    } catch (error: any) {
      toast({
        title: "Failed to Load Status",
        description: error.message || "Could not fetch enrollment status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsentUpload = async (personId: string, file: File) => {
    setUploadingPersonId(personId);
    try {
      await uploadPersonConsent(projectId, personId, file);
      toast({
        title: "Consent Uploaded",
        description: "Consent PDF has been uploaded successfully",
      });
      await loadEnrollmentStatus();
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload consent",
        variant: "destructive",
      });
    } finally {
      setUploadingPersonId(null);
    }
  };

  const handleExportExcel = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const token = localStorage.getItem('token');
    const url = `${apiUrl}/api/enrollments/projects/${projectId}/enrollment-status/export`;
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    link.style.display = 'none';
    
    // Add authorization header via fetch and create blob
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => response.blob())
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      link.href = blobUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      toast({
        title: "Export Successful",
        description: "Consent status exported to Excel",
      });
    })
    .catch(error => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data",
        variant: "destructive",
      });
    });
  };

  const getConsentBadge = (status: string) => {
    switch (status) {
      case "matching":
        return (
          <Badge variant="outline" className="border-green-500 text-green-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Matching
          </Badge>
        );
      case "not_matching":
        return (
          <Badge variant="outline" className="border-red-500 text-red-500">
            <XCircle className="mr-1 h-3 w-3" />
            Not Matching
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-500">
            <Clock className="mr-1 h-3 w-3" />
            Pending Detection
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Consent Matching Status</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          disabled={enrollmentStatuses.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </CardHeader>
      <CardContent>
        {enrollmentStatuses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No enrolled users yet. Enroll users to see their consent status.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>PID</TableHead>
                <TableHead>Detected</TableHead>
                <TableHead>Consent Status</TableHead>
                <TableHead>Match Confidence</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollmentStatuses.map((status) => (
                <TableRow key={status.user_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{status.user_name}</p>
                      <p className="text-xs text-muted-foreground">{status.user_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {status.pid ? (
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {status.pid}
                      </code>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {status.is_detected ? (
                      <Badge variant="outline" className="border-green-500 text-green-500">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-gray-400 text-gray-600">
                        <XCircle className="mr-1 h-3 w-3" />
                        No
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{getConsentBadge(status.consent_status)}</TableCell>
                  <TableCell>
                    {status.match_confidence !== null ? (
                      <span className="font-mono text-sm">{status.match_confidence}%</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {status.consent_status === "not_matching" && status.person_id && (
                      <div className="relative">
                        <Input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          id={`consent-upload-${status.person_id}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && status.person_id) {
                              handleConsentUpload(status.person_id, file);
                            }
                          }}
                          disabled={uploadingPersonId === status.person_id}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            document.getElementById(`consent-upload-${status.person_id}`)?.click();
                          }}
                          disabled={uploadingPersonId === status.person_id}
                        >
                          {uploadingPersonId === status.person_id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          Upload Consent
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
