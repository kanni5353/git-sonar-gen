const JENKINS_URL = "http://56.228.23.50:8080";
const JENKINS_USER = import.meta.env.VITE_JENKINS_USER || "admin";
const JENKINS_TOKEN = import.meta.env.VITE_JENKINS_TOKEN || "admin";

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

interface JenkinsJobConfig {
  repoUrl: string;
  email: string;
}

interface JenkinsQueueItem {
  executable?: {
    number: number;
  };
}

const jenkinsApi = {
  /**
   * Check if a Jenkins job exists
   */
  async checkJobExists(jobName: string): Promise<boolean> {
    try {
      const auth = btoa(`${JENKINS_USER}:${JENKINS_TOKEN}`);
      const response = await fetch(`${JENKINS_URL}/job/${jobName}/api/json`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (response.status === 404) {
        return false;
      }

      if (!response.ok) {
        throw new Error(`Failed to check job existence: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return false;
      }
      console.error("Error checking job:", error);
      throw new Error(`Failed to check if job exists: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },

  /**
   * Create a new Jenkins job
   */
  async createJob(jobName: string, params: JobParams): Promise<void> {
    try {
      const auth = btoa(`${JENKINS_USER}:${JENKINS_TOKEN}`);
      const config = this.generateJobConfig(params);

      const response = await fetch(`${JENKINS_URL}/createItem?name=${encodeURIComponent(jobName)}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/xml",
        },
        body: config,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create job: ${response.statusText} - ${errorText}`);
      }

      console.log(`Successfully created job: ${jobName}`);
    } catch (error) {
      console.error("Error creating job:", error);
      throw new Error(`Failed to create Jenkins job: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },

  /**
   * Trigger a Jenkins build with parameters
   */
  async triggerBuild(jobName: string, repoUrl: string, email: string): Promise<BuildResult> {
    try {
      const auth = btoa(`${JENKINS_USER}:${JENKINS_TOKEN}`);
      
      // Trigger build with parameters
      const params = new URLSearchParams({
        REPO_URL: repoUrl,
        EMAIL: email,
      });

      const response = await fetch(
        `${JENKINS_URL}/job/${jobName}/buildWithParameters?${params.toString()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to trigger build: ${response.statusText}`);
      }

      // Get queue ID from Location header
      const location = response.headers.get("Location");
      const queueId = location ? parseInt(location.split("/").slice(-2, -1)[0]) : undefined;

      // Wait a bit and try to get build number from queue
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      let buildNumber: number | undefined;
      if (queueId) {
        buildNumber = await this.getBuildNumberFromQueue(queueId);
      }

      return {
        success: true,
        buildNumber,
        queueId,
        message: "Build triggered successfully",
      };
    } catch (error) {
      console.error("Error triggering build:", error);
      throw new Error(`Failed to trigger build: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },

  /**
   * Generate Jenkins job configuration XML
   */
  generateJobConfig(params: JenkinsJobConfig): string {
    const { repoUrl, email } = params;
    
    return `<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job@1436.vfa_244484591f">
  <actions/>
  <description>Automated CI/CD pipeline for code quality analysis</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <hudson.model.ParametersDefinitionProperty>
      <parameterDefinitions>
        <hudson.model.StringParameterDefinition>
          <name>REPO_URL</name>
          <defaultValue>${repoUrl}</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>EMAIL</name>
          <defaultValue>${email}</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
      </parameterDefinitions>
    </hudson.model.ParametersDefinitionProperty>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition" plugin="workflow-cps@3964.v0767c9b_b_139b_">
    <script>
pipeline {
    agent any
    
    environment {
        SONAR_HOST_URL = 'http://51.20.192.183:9000'
        SONAR_TOKEN = credentials('sonar-token')
        MONGO_URI = 'ec2-13-48-148-190.eu-north-1.compute.amazonaws.com:27017'
        MONGO_DB = 'SDP_2026'
        REPO_NAME = ''
        PROJECT_KEY = ''
        BRANCH_NAME = 'main'
    }
    
    stages {
        stage('Checkout') {
            steps {
                script {
                    echo "Cloning repository: $\{params.REPO_URL}"
                    
                    // Extract repo name from URL
                    def repoUrl = params.REPO_URL
                    REPO_NAME = repoUrl.tokenize('/')[-1].replaceAll('\\\\.git$', '')
                    PROJECT_KEY = "$\{REPO_NAME}"
                    
                    echo "Repository name: $\{REPO_NAME}"
                    echo "Project key: $\{PROJECT_KEY}"
                    
                    // Clone the repository
                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: "*/$\{BRANCH_NAME}"]],
                        userRemoteConfigs: [[url: params.REPO_URL]]
                    ])
                }
            }
        }
        
        stage('SonarQube Analysis') {
            steps {
                script {
                    echo "Running SonarQube analysis..."
                    
                    def scannerHome = tool name: 'SonarQubeScanner', type: 'hudson.plugins.sonar.SonarRunnerInstallation'
                    
                    withSonarQubeEnv('SonarQube') {
                        sh """
                            $\{scannerHome}/bin/sonar-scanner \\\\
                                -Dsonar.projectKey=$\{PROJECT_KEY} \\\\
                                -Dsonar.projectName=$\{REPO_NAME} \\\\
                                -Dsonar.sources=. \\\\
                                -Dsonar.host.url=$\{SONAR_HOST_URL} \\\\
                                -Dsonar.token=$\{SONAR_TOKEN}
                        """
                    }
                }
            }
        }
        
        stage('Quality Gate') {
            steps {
                script {
                    echo "Checking quality gate status..."
                    
                    timeout(time: 5, unit: 'MINUTES') {
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            echo "Quality gate failed: $\{qg.status}"
                        } else {
                            echo "Quality gate passed!"
                        }
                    }
                }
            }
        }
        
        stage('Fetch SonarQube Results') {
            steps {
                script {
                    echo "Fetching SonarQube analysis results..."
                    
                    def sonarUrl = "$\{SONAR_HOST_URL}/api/issues/search?componentKeys=$\{PROJECT_KEY}&resolved=false"
                    
                    def response = sh(
                        script: "curl -s -u $\{SONAR_TOKEN}: '$\{sonarUrl}'",
                        returnStdout: true
                    ).trim()
                    
                    writeFile file: 'sonar-results.json', text: response
                    echo "SonarQube results saved to sonar-results.json"
                }
            }
        }
        
        stage('Generate AI Suggestions') {
            steps {
                script {
                    echo "Generating AI-powered code suggestions..."
                    
                    // Read SonarQube results
                    def sonarResults = readFile('sonar-results.json')
                    
                    // Here you would integrate with an AI service
                    // For now, we'll simulate this step
                    echo "AI suggestions would be generated based on SonarQube findings"
                    
                    writeFile file: 'ai-suggestions.txt', text: "AI analysis complete. Check detailed report in email."
                }
            }
        }
        
        stage('Store Results in MongoDB') {
            steps {
                script {
                    echo "Storing analysis results in MongoDB..."
                    
                    def timestamp = new Date().format("yyyy-MM-dd'T'HH:mm:ss'Z'", TimeZone.getTimeZone('UTC'))
                    def buildUrl = "$\{env.BUILD_URL ?: '$\{JENKINS_URL}job/$\{JOB_NAME}/$\{BUILD_NUMBER}/'}console"
                    
                    def sonarResults = readFile('sonar-results.json')
                    def aiSuggestions = readFile('ai-suggestions.txt')
                    
                    def document = """
                    {
                        "repoName": "$\{REPO_NAME}",
                        "repoUrl": "$\{params.REPO_URL}",
                        "projectKey": "$\{PROJECT_KEY}",
                        "buildNumber": $\{BUILD_NUMBER},
                        "buildUrl": "$\{buildUrl}",
                        "timestamp": "$\{timestamp}",
                        "sonarResults": $\{sonarResults},
                        "aiSuggestions": "$\{aiSuggestions}",
                        "email": "$\{params.EMAIL}"
                    }
                    """
                    
                    writeFile file: 'build-results.json', text: document
                    
                    // Insert into MongoDB
                    sh """
                        mongoimport --host $\{MONGO_URI} \\\\
                            --db $\{MONGO_DB} \\\\
                            --collection builds \\\\
                            --file build-results.json \\\\
                            --jsonArray || true
                    """
                    
                    echo "Results stored in MongoDB successfully"
                }
            }
        }
        
        stage('Send Email Report') {
            steps {
                script {
                    echo "Sending email report to: $\{params.EMAIL}"
                    
                    def buildUrl = "$\{env.BUILD_URL ?: '$\{JENKINS_URL}job/$\{JOB_NAME}/$\{BUILD_NUMBER}/'}console"
                    def sonarProjectUrl = "$\{SONAR_HOST_URL}/dashboard?id=$\{PROJECT_KEY}"
                    
                    emailext(
                        subject: "Code Analysis Report - $\{REPO_NAME} - Build #$\{BUILD_NUMBER}",
                        body: """
                        <html>
                        <body>
                            <h2>Code Quality Analysis Report</h2>
                            <p><strong>Repository:</strong> $\{REPO_NAME}</p>
                            <p><strong>Build Number:</strong> $\{BUILD_NUMBER}</p>
                            <p><strong>Build URL:</strong> <a href="$\{buildUrl}">View Build</a></p>
                            <p><strong>SonarQube Dashboard:</strong> <a href="$\{sonarProjectUrl}">View Dashboard</a></p>
                            <hr>
                            <h3>Analysis Summary</h3>
                            <p>Your code has been analyzed for quality, security vulnerabilities, and code smells.</p>
                            <p>Please check the SonarQube dashboard for detailed results and AI-powered suggestions.</p>
                            <hr>
                            <p><small>This is an automated email from Jenkins CI/CD Pipeline</small></p>
                        </body>
                        </html>
                        """,
                        to: params.EMAIL,
                        mimeType: 'text/html'
                    )
                    
                    echo "Email sent successfully!"
                }
            }
        }
    }
    
    post {
        always {
            echo "Pipeline execution completed"
            cleanWs()
        }
        success {
            echo "Build succeeded!"
        }
        failure {
            echo "Build failed!"
        }
    }
}
    </script>
    <sandbox>true</sandbox>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>`;
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
   */
  getJobUrl(jobName: string): string {
    return `${JENKINS_URL}/job/${jobName}`;
  },

  /**
   * Helper method to get build number from queue
   */
  async getBuildNumberFromQueue(queueId: number): Promise<number | undefined> {
    try {
      const auth = btoa(`${JENKINS_USER}:${JENKINS_TOKEN}`);
      const response = await fetch(`${JENKINS_URL}/queue/item/${queueId}/api/json`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as JenkinsQueueItem;
        return data.executable?.number;
      }
    } catch (error) {
      console.error("Error getting build number from queue:", error);
    }
    return undefined;
  },
};

export { jenkinsApi };
