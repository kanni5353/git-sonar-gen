const JENKINS_URL = "http://13.61.15.150:8080";
const JENKINS_USER = "vercel-deployer";
const JENKINS_API_TOKEN = "11c91008d123dd22189e5e7fd20894ee5b";

// Base64 encode credentials for Basic Auth
const authHeader = btoa(`${JENKINS_USER}:${JENKINS_API_TOKEN}`);

interface JenkinsJobConfig {
  repoUrl: string;
  email: string;
}

export const jenkinsApi = {
  /**
   * Check if a Jenkins job exists for the given repository
   */
  async checkJobExists(repoName: string): Promise<boolean> {
    try {
      const response = await fetch(`${JENKINS_URL}/job/${repoName}/api/json`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Error checking job existence:", error);
      return false;
    }
  },

  /**
   * Create a new Jenkins job with the provided configuration
   */
  async createJob(repoName: string, config: JenkinsJobConfig): Promise<boolean> {
    try {
      // Create the Jenkins job XML configuration
      const jobConfig = this.generateJobConfig(config);

      const response = await fetch(`${JENKINS_URL}/createItem?name=${encodeURIComponent(repoName)}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/xml",
        },
        body: jobConfig,
      });

      if (!response.ok) {
        throw new Error(`Failed to create job: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error("Error creating job:", error);
      throw error;
    }
  },

  /**
   * Trigger a build for an existing Jenkins job
   */
  async triggerBuild(repoName: string): Promise<{ success: boolean; buildNumber?: number }> {
    try {
      const response = await fetch(`${JENKINS_URL}/job/${repoName}/build`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger build: ${response.statusText}`);
      }

      // Get the latest build number
      const jobInfo = await fetch(`${JENKINS_URL}/job/${repoName}/api/json`, {
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
      });

      if (jobInfo.ok) {
        const data = await jobInfo.json();
        const buildNumber = data.nextBuildNumber || data.lastBuild?.number;
        return { success: true, buildNumber };
      }

      return { success: true };
    } catch (error) {
      console.error("Error triggering build:", error);
      throw error;
    }
  },

  /**
   * Generate Jenkins job configuration XML
   */
  generateJobConfig(config: JenkinsJobConfig): string {
    const { repoUrl, email } = config;

    // Extract repository name from URL for display
    const repoName = repoUrl.split("/").slice(-1)[0].replace(".git", "");

    return `<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job@2.40">
  <description>Automated CI/CD for ${repoName}</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
      <triggers>
        <com.cloudbees.jenkins.GitHubPushTrigger plugin="github@1.34.1">
          <spec></spec>
        </com.cloudbees.jenkins.GitHubPushTrigger>
      </triggers>
    </org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps@2.92">
    <scm class="hudson.plugins.git.GitSCM" plugin="git@4.11.0">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>${repoUrl}</url>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/main</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="list"/>
      <extensions/>
    </scm>
    <scriptPath>Jenkinsfile</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>`;
  },

  /**
   * Extract repository name from GitHub URL
   */
  extractRepoName(repoUrl: string): string {
    const parts = repoUrl.replace(/\.git$/, "").split("/");
    return parts[parts.length - 1];
  },

  /**
   * Get Jenkins job URL
   */
  getJobUrl(repoName: string): string {
    return `${JENKINS_URL}/job/${encodeURIComponent(repoName)}`;
  },
};
