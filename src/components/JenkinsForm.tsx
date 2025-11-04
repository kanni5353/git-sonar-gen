import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JenkinsFormProps {
  onSubmit: (repoUrl: string, email: string) => Promise<void>;
  isLoading: boolean;
}

const MAX_EMAILS = 5;

export const JenkinsForm = ({ onSubmit, isLoading }: JenkinsFormProps) => {
  const [repoUrl, setRepoUrl] = useState("");
  const [emails, setEmails] = useState<string[]>([""]);
  const [errors, setErrors] = useState<{ repoUrl?: string; emails?: string[] }>({});
  const { toast } = useToast();

  const addEmailField = () => {
    if (emails.length < MAX_EMAILS) {
      setEmails([...emails, ""]);
    }
  };

  const removeEmailField = (index: number) => {
    if (emails.length > 1) {
      const newEmails = emails.filter((_, i) => i !== index);
      setEmails(newEmails);
      // Clear errors for removed field
      if (errors.emails) {
        const newEmailErrors = errors.emails.filter((_, i) => i !== index);
        setErrors({ ...errors, emails: newEmailErrors });
      }
    }
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
    // Clear error for this field
    if (errors.emails?.[index]) {
      const newEmailErrors = [...(errors.emails || [])];
      newEmailErrors[index] = "";
      setErrors({ ...errors, emails: newEmailErrors });
    }
  };

  const validateForm = () => {
    const newErrors: { repoUrl?: string; emails?: string[] } = {};

    // GitHub URL validation
    const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
    if (!repoUrl.trim()) {
      newErrors.repoUrl = "Repository URL is required";
    } else if (!githubUrlPattern.test(repoUrl.trim())) {
      newErrors.repoUrl = "Please enter a valid GitHub repository URL";
    }

    // Email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailErrors: string[] = [];
    let hasValidEmail = false;

    emails.forEach((email, index) => {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        emailErrors[index] = "Email address is required";
      } else if (!emailPattern.test(trimmedEmail)) {
        emailErrors[index] = "Please enter a valid email address";
      } else {
        emailErrors[index] = "";
        hasValidEmail = true;
      }
    });

    if (!hasValidEmail || emailErrors.some((err) => err !== "")) {
      newErrors.emails = emailErrors;
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

    // Combine all emails into comma-separated string
    const validEmails = emails.map((e) => e.trim()).filter((e) => e !== "");
    const emailString = validEmails.join(",");

    await onSubmit(repoUrl.trim(), emailString);
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
            <Label htmlFor="email-0" className="text-base">
              {emails.length === 1 ? "Email Address" : "Email Addresses"}
            </Label>
            {emails.length > 1 && (
              <p className="text-sm text-muted-foreground">
                Additional recipients will also receive build reports
              </p>
            )}
            <div className="space-y-3">
              {emails.map((email, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    {emails.length > 1 && (
                      <Label htmlFor={`email-${index}`} className="text-sm text-muted-foreground">
                        Email Address {index + 1}
                      </Label>
                    )}
                    <Input
                      id={`email-${index}`}
                      type="email"
                      placeholder={index === 0 ? "your.email@example.com" : "additional.email@example.com"}
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      className={errors.emails?.[index] ? "border-destructive" : ""}
                      disabled={isLoading}
                    />
                    {errors.emails?.[index] && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>{errors.emails[index]}</span>
                      </div>
                    )}
                  </div>
                  {emails.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-0.5 text-muted-foreground hover:text-destructive"
                      onClick={() => removeEmailField(index)}
                      disabled={isLoading}
                      aria-label={`Remove email ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {emails.length < MAX_EMAILS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={addEmailField}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Email
              </Button>
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
