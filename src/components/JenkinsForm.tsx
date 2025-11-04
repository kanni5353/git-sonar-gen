import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JenkinsFormProps {
  onSubmit: (repoUrl: string, email: string) => Promise<void>;
  isLoading: boolean;
}

export const JenkinsForm = ({ onSubmit, isLoading }: JenkinsFormProps) => {
  const [repoUrl, setRepoUrl] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ repoUrl?: string; email?: string }>({});
  const { toast } = useToast();

  const validateForm = () => {
    const newErrors: { repoUrl?: string; email?: string } = {};

    // GitHub URL validation
    const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
    if (!repoUrl.trim()) {
      newErrors.repoUrl = "Repository URL is required";
    } else if (!githubUrlPattern.test(repoUrl.trim())) {
      newErrors.repoUrl = "Please enter a valid GitHub repository URL";
    }

    // Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!emailPattern.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fix the errors before submitting.",
      });
      return;
    }

    await onSubmit(repoUrl.trim(), email.trim());
  };

  return (
    <Card className="w-full max-w-2xl shadow-card animate-slide-up">
      <CardHeader>
        <CardTitle className="text-2xl">Deploy Your Repository</CardTitle>
        <CardDescription>
          Enter your GitHub repository and email to automate Jenkins CI/CD
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="repoUrl" className="text-base">
              GitHub Repository URL
            </Label>
            <Input
              id="repoUrl"
              type="url"
              placeholder="https://github.com/username/repository"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                if (errors.repoUrl) setErrors({ ...errors, repoUrl: undefined });
              }}
              className={errors.repoUrl ? "border-destructive" : ""}
              disabled={isLoading}
            />
            {errors.repoUrl && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.repoUrl}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              className={errors.email ? "border-destructive" : ""}
              disabled={isLoading}
            />
            {errors.email && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.email}</span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                Deploy to Jenkins
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
