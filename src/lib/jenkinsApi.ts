// Jenkins credentials are now handled server-side for security
// All Jenkins API calls go through backend proxy to avoid Mixed Content errors

interface JobParams {
  repoUrl: string;
  email: string;
}

interface BuildResult {
  success: boolean;
  buildNumber?: number;
  queueId?: number;
  message?: string;
}

const jenkinsApi = {
  /**
   * Check if a Jenkins job exists
   * Uses backend API to avoid Mixed Content security errors
   */
  async checkJobExists(jobName: string): Promise<boolean> {
    try {
      const response = await fetch("/api/check-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to check job: ${response.statusText}`);
      }

      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error("Error checking job:", error);
      throw new Error(`Failed to check if job exists: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },

  /**
   * Create a new Jenkins job
   * Uses backend API to avoid Mixed Content security errors
   */
  async createJob(jobName: string, params: JobParams): Promise<void> {
    try {
      const response = await fetch("/api/create-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobName,
          repoUrl: params.repoUrl,
          email: params.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create job: ${errorData.error || response.statusText}`);
      }

      console.log(`Successfully created job: ${jobName}`);
    } catch (error) {
      console.error("Error creating job:", error);
      throw new Error(`Failed to create Jenkins job: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },

  /**
   * Trigger a Jenkins build with parameters
   * Uses backend API to avoid Mixed Content security errors
   */
  async triggerBuild(jobName: string, repoUrl: string, email: string): Promise<BuildResult> {
    try {
      const response = await fetch("/api/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobName,
          params: {
            REPO_URL: repoUrl,
            USER_EMAIL: email,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to trigger build: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: data.success,
        buildNumber: data.buildNumber,
        queueId: data.queueId,
        message: "Build triggered successfully",
      };
    } catch (error) {
      console.error("Error triggering build:", error);
      throw new Error(`Failed to trigger build: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },

  /**
   * Extract repository name from URL
   */
  extractRepoName(repoUrl: string): string {
    const parts = repoUrl.split("/");
    const lastPart = parts[parts.length - 1];
    return lastPart.replace(/\.git$/, "");
  },

  /**
   * Get the Jenkins job URL
   * Returns the public Jenkins URL for display purposes
   */
  getJobUrl(jobName: string): string {
    // This returns the Jenkins URL for display only
    // Actual API calls go through the backend proxy
    return `http://56.228.23.50:8080/job/${jobName}`;
  },
};

export { jenkinsApi };
