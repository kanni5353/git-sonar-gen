import { useState } from "react";
import { JenkinsForm } from "@/components/JenkinsForm";
import { StatusDisplay } from "@/components/StatusDisplay";
import { jenkinsApi } from "@/lib/jenkinsApi";
import { useToast } from "@/hooks/use-toast";
import { GitBranch } from "lucide-react";
import heroCicd from "@/assets/hero-cicd.jpg";

type Status = "idle" | "checking" | "creating" | "building" | "success" | "error";

const Index = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const [jobUrl, setJobUrl] = useState<string>("");
  const [buildNumber, setBuildNumber] = useState<number | undefined>();
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const { toast } = useToast();

  const handleSubmit = async (repoUrlInput: string, emailInput: string) => {
    setRepoUrl(repoUrlInput);
    setEmail(emailInput);
    setStatus("checking");
    setMessage("");

    try {
      // Extract repository name from URL
      const repoName = jenkinsApi.extractRepoName(repoUrlInput);
      
      // Check if job already exists
      const jobExists = await jenkinsApi.checkJobExists(repoName);

      if (!jobExists) {
        // Create new job
        setStatus("creating");
        await jenkinsApi.createJob(repoName, { repoUrl: repoUrlInput, email: emailInput });
        
        toast({
          title: "Job Created",
          description: `Successfully created Jenkins job for ${repoName}`,
        });

        // Wait a moment for job to be ready
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        toast({
          title: "Job Found",
          description: `Jenkins job already exists for ${repoName}`,
        });
      }

      // Trigger build
      setStatus("building");
      const buildResult = await jenkinsApi.triggerBuild(repoName);
      
      if (buildResult.success) {
        setBuildNumber(buildResult.buildNumber);
        setJobUrl(jenkinsApi.getJobUrl(repoName));
        
        // Simulate build completion (in production, you'd poll Jenkins API)
        await new Promise((resolve) => setTimeout(resolve, 3000));
        
        setStatus("success");
        setMessage("Your build has been queued successfully. Check your email for the analysis report.");
        
        toast({
          title: "Build Started",
          description: `Build #${buildResult.buildNumber || "N/A"} is now running. You'll receive an email when complete.`,
        });
      }
    } catch (error) {
      setStatus("error");
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      setMessage(errorMessage);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-90" />
        <div
          className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-20"
          style={{ backgroundImage: `url(${heroCicd})` }}
        />
        
        <div className="relative container mx-auto px-4 py-16 sm:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Automated CI/CD Pipeline</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary-foreground leading-tight">
              Deploy with Jenkins,
              <br />
              <span className="text-primary-glow">Analyze with SonarQube</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
              Automate your code quality analysis and deployment pipeline. 
              Simply enter your GitHub repository and let our Jenkins automation handle the rest.
            </p>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <div className="flex flex-col items-center gap-8">
          <JenkinsForm onSubmit={handleSubmit} isLoading={status !== "idle" && status !== "success" && status !== "error"} />
          
          {status !== "idle" && (
            <StatusDisplay
              status={status}
              message={message}
              jobUrl={jobUrl}
              buildNumber={buildNumber}
              repoUrl={repoUrl}
              email={email}
            />
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">What You Get</h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-card rounded-lg shadow-card border border-border">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <GitBranch className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Automated Builds</h3>
              <p className="text-muted-foreground text-sm">
                Trigger builds automatically or on-demand with full pipeline automation
              </p>
            </div>

            <div className="p-6 bg-card rounded-lg shadow-card border border-border">
              <div className="h-12 w-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Code Quality Analysis</h3>
              <p className="text-muted-foreground text-sm">
                Comprehensive SonarQube analysis including bugs, vulnerabilities, and code smells
              </p>
            </div>

            <div className="p-6 bg-card rounded-lg shadow-card border border-border">
              <div className="h-12 w-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Email Reports</h3>
              <p className="text-muted-foreground text-sm">
                Detailed analysis reports and AI suggestions delivered directly to your inbox
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
