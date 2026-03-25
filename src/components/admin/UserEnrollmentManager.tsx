import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { enrollUser, unenrollUser, getEnrolledUsers, getAllUsers } from "@/lib/api/enrollments";
import { UserPlus, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { UserResponse } from "@/lib/api-types";

interface UserEnrollmentManagerProps {
  projectId: string;
  onEnrollmentChange?: () => void;
}

export const UserEnrollmentManager = ({ projectId, onEnrollmentChange }: UserEnrollmentManagerProps) => {
  const { toast } = useToast();
  const [allUsers, setAllUsers] = useState<UserResponse[]>([]);
  const [enrolledUsers, setEnrolledUsers] = useState<UserResponse[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [users, enrolled] = await Promise.all([
        getAllUsers(),
        getEnrolledUsers(projectId),
      ]);
      setAllUsers(users);
      setEnrolledUsers(enrolled);
    } catch (error: any) {
      toast({
        title: "Failed to Load Users",
        description: error.message || "Could not fetch user data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedUserId) return;

    setIsEnrolling(true);
    try {
      await enrollUser(projectId, selectedUserId);
      toast({
        title: "User Enrolled",
        description: "User has been enrolled in the project successfully",
      });
      setSelectedUserId("");
      await loadData();
      onEnrollmentChange?.();
    } catch (error: any) {
      toast({
        title: "Enrollment Failed",
        description: error.message || "Failed to enroll user",
        variant: "destructive",
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleUnenroll = async (userId: string) => {
    try {
      await unenrollUser(projectId, userId);
      toast({
        title: "User Removed",
        description: "User has been removed from the project",
      });
      await loadData();
      onEnrollmentChange?.();
    } catch (error: any) {
      toast({
        title: "Removal Failed",
        description: error.message || "Failed to remove user",
        variant: "destructive",
      });
    }
  };

  const availableUsers = allUsers.filter(
    (user) => !enrolledUsers.some((enrolled) => enrolled.id === user.id)
  );

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
      <CardHeader>
        <CardTitle>Enrolled Users</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enrollment Form */}
        <div className="flex gap-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a user to enroll" />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    <span>{user.full_name || user.email}</span>
                    {user.identity_image_url && (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleEnroll}
            disabled={!selectedUserId || isEnrolling}
          >
            {isEnrolling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Enroll
          </Button>
        </div>

        {/* Enrolled Users List */}
        <div className="space-y-2">
          {enrolledUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No users enrolled yet
            </p>
          ) : (
            enrolledUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">{user.full_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.pid && (
                      <p className="text-xs text-muted-foreground">PID: {user.pid}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.identity_image_url ? (
                    <Badge variant="outline" className="border-green-500 text-green-500">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Identity
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500 text-amber-500">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      No Identity
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnenroll(user.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
