import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Clock, GitBranch, Mail } from "lucide-react";

interface StatusDisplayProps {
  status: "idle" | "checking" | "creating" | "building" | "success" | "error";
  message?: string;
  jobUrl?: string;
  buildNumber?: number;
  repoUrl?: string;
  email?: string;
}

export const StatusDisplay = ({
  status,
  message,
  jobUrl,
  buildNumber,
  repoUrl,
  email,
}: StatusDisplayProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case "checking":
        return {
          icon: <Loader2 className="h-8 w-8 animate-spin text-primary" />,
          title: "Checking Repository",
          description: "Verifying if Jenkins job exists...",
          badge: <Badge className="bg-primary/10 text-primary">In Progress</Badge>,
        };
      case "creating":
        return {
          icon: <Loader2 className="h-8 w-8 animate-spin text-secondary" />,
          title: "Creating Jenkins Job",
          description: "Setting up your CI/CD pipeline...",
          badge: <Badge className="bg-secondary/10 text-secondary">Creating</Badge>,
        };
      case "building":
        return {
          icon: <Loader2 className="h-8 w-8 animate-spin text-accent" />,
          title: "Building Project",
          description: "Running SonarQube analysis and tests...",
          badge: <Badge className="bg-accent/10 text-accent">Building</Badge>,
        };
      case "success":
        return {
          icon: <CheckCircle className="h-8 w-8 text-success" />,
          title: "Build Successful!",
          description: "Your project has been analyzed and deployed.",
          badge: <Badge className="bg-success/10 text-success">Success</Badge>,
        };
      case "error":
        return {
          icon: <XCircle className="h-8 w-8 text-destructive" />,
          title: "Build Failed",
          description: message || "An error occurred during the build process.",
          badge: <Badge className="bg-destructive/10 text-destructive">Failed</Badge>,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();

  if (!config || status === "idle") {
    return null;
  }

  return (
    <Card className="w-full max-w-2xl shadow-card animate-slide-up border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.icon}
            <div>
              <CardTitle className="text-xl">{config.title}</CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
          </div>
          {config.badge}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {repoUrl && (
          <div className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Repository:</span>
            <code className="px-2 py-1 bg-muted rounded text-xs">{repoUrl}</code>
          </div>
        )}

        {email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Report will be sent to:</span>
            <code className="px-2 py-1 bg-muted rounded text-xs">{email}</code>
          </div>
        )}

        {buildNumber && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Build Number:</span>
            <span className="font-semibold">#{buildNumber}</span>
          </div>
        )}

        {jobUrl && status === "success" && (
          <a
            href={jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-glow transition-colors font-medium"
          >
            View Jenkins Job →
          </a>
        )}

        {message && status === "error" && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
