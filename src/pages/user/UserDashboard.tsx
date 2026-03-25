import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { sampleProjects } from "@/data/sampleData";
import { useAuth } from "@/contexts/AuthContext";
import { uploadIdentity, uploadUserConsent } from "@/lib/api/users";
import { Eye, CheckCircle2, AlertCircle, Loader2, Upload } from "lucide-react";

const UserDashboard = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isUploadingIdentity, setIsUploadingIdentity] = useState(false);
  const [isUploadingConsent, setIsUploadingConsent] = useState(false);
  const { toast } = useToast();

  const enrolled = sampleProjects.filter((p) =>
    p.enrolledUsers.includes(user?.email ?? "")
  );

  const handleIdentityUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    setIsUploadingIdentity(true);
    try {
      await uploadIdentity(e.target.files[0]);
      toast({
        title: "Identity Uploaded",
        description: "Your identity image has been processed successfully.",
      });
      await refreshProfile();
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload identity image",
        variant: "destructive",
      });
    } finally {
      setIsUploadingIdentity(false);
    }
  };

  const handleConsentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    setIsUploadingConsent(true);
    try {
      await uploadUserConsent(e.target.files[0]);
      toast({
        title: "Consent Uploaded",
        description: "Your consent form has been uploaded successfully.",
      });
      await refreshProfile();
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload consent form",
        variant: "destructive",
      });
    } finally {
      setIsUploadingConsent(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in-0 duration-300">
        
        {/* Profile Completion Section */}
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        Identity Verification
                        {user?.identity_image_url ? (
                            <CheckCircle2 className="text-green-500 h-5 w-5" />
                        ) : (
                            <AlertCircle className="text-amber-500 h-5 w-5" />
                        )}
                    </CardTitle>
                    <CardDescription>
                        Upload a clear selfie to verify your identity across projects.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {user?.identity_image_url ? (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                            <CheckCircle2 className="h-4 w-4" /> Identity Verified
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                disabled={isUploadingIdentity}
                                onClick={() => document.getElementById('identity-upload')?.click()}
                            >
                                {isUploadingIdentity ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="mr-2 h-4 w-4" />
                                )}
                                Upload Selfie
                            </Button>
                            <input 
                                id="identity-upload" 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleIdentityUpload}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        Global Consent
                        {user?.consent_pdf_url ? (
                            <CheckCircle2 className="text-green-500 h-5 w-5" />
                        ) : (
                            <AlertCircle className="text-amber-500 h-5 w-5" />
                        )}
                    </CardTitle>
                    <CardDescription>
                        Upload your signed consent form to authorize use of your data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     {user?.consent_pdf_url ? (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                            <CheckCircle2 className="h-4 w-4" /> Consent Form on File
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                disabled={isUploadingConsent}
                                onClick={() => document.getElementById('consent-upload')?.click()}
                            >
                                {isUploadingConsent ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="mr-2 h-4 w-4" />
                                )}
                                Upload PDF
                            </Button>
                            <input 
                                id="consent-upload" 
                                type="file" 
                                accept="application/pdf" 
                                className="hidden" 
                                onChange={handleConsentUpload}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">My Projects</h1>
          <p className="text-sm text-muted-foreground">Projects you are enrolled in</p>
        </div>

        {enrolled.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">You are not enrolled in any projects.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enrolled.map((project) => (
              <Card key={project.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge variant="secondary" className="capitalize">{project.status}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Since {project.createdAt}</span>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/user/projects/${project.id}`)}>
                    <Eye className="mr-1 h-4 w-4" /> View
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default UserDashboard;
