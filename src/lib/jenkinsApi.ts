const JENKINS_URL = "http://13.61.15.150:8080";

interface JenkinsJobConfig {
  repoUrl: string;
  email: string;
}

// Helper function to safely parse JSON responses
async function safeJsonParse(response: Response) {
  const contentType = response.headers.get("content-type");
  
  // Check if response is actually JSON
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error("Expected JSON but got:", contentType, text.substring(0, 200));
    throw new Error(`API returned non-JSON response. Content-Type: ${contentType}. This usually means the API endpoint is not found or there's a server error.`);
  }
  
  try {
    return await response.json();
  } catch (error) {
    const text = await response.text();
    console.error("Failed to parse JSON:", text.substring(0, 200));
    throw new Error(`Invalid JSON response from API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const jenkinsApi = {
  /**
   * Check if a Jenkins job exists for the given repository
   */
  async checkJobExists(repoName: string): Promise<boolean> {
    try {
      console.log("Checking if job exists:", repoName);
      const response = await fetch("/api/check-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobName: repoName }),
      });

      if (!response.ok) {
        console.error("Check job failed with status:", response.status);
        const text = await response.text();
        console.error("Response:", text.substring(0, 200));
        throw new Error(`Failed to check job: ${response.statusText}`);
      }

      const data = await safeJsonParse(response);
      console.log("Job exists:", data.exists);
      return data.exists;
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
      console.log("Creating job:", repoName);
      const response = await fetch("/api/create-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobName: repoName,
          repoUrl: config.repoUrl,
          email: config.email,
        }),
      });

      if (!response.ok) {
        console.error("Create job failed with status:", response.status);
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to create job: ${response.statusText}`);
        } else {
          const text = await response.text();
          console.error("Non-JSON error response:", text.substring(0, 200));
          throw new Error(`Failed to create job: ${response.statusText}. API may not be available.`);
        }
      }

      const data = await safeJsonParse(response);
      console.log("Job created successfully:", data);
      return data.success;
    } catch (error) {
      console.error("Error creating job:", error);
      throw error;
    }
  },

  /**
   * Trigger a build for an existing Jenkins job with parameters
   */
  async triggerBuild(repoName: string, repoUrl: string, email: string): Promise<{ success: boolean; buildNumber?: number }> {
    try {
      console.log("Triggering build for:", repoName);
      const response = await fetch("/api/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobName: repoName,
          repoUrl,
          email,
          params: {
            REPO_URL: repoUrl,
            USER_EMAIL: email,
          },
        }),
      });

      if (!response.ok) {
        console.error("Trigger build failed with status:", response.status);
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to trigger build: ${response.statusText}`);
        } else {
          const text = await response.text();
          console.error("Non-JSON error response:", text.substring(0, 200));
          throw new Error(`Failed to trigger build: ${response.statusText}. API may not be available.`);
        }
      }

      const data = await safeJsonParse(response);
      console.log("Build triggered successfully:", data);
      return { success: data.success, buildNumber: data.buildNumber };
    } catch (error) {
      console.error("Error triggering build:", error);
      throw error;
    }
  },

  /**
   * Generate Jenkins job configuration XML with inline pipeline script
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
    <hudson.model.ParametersDefinitionProperty>
      <parameterDefinitions>
        <hudson.model.StringParameterDefinition>
          <name>REPO_URL</name>
          <description>GitHub Repository URL</description>
          <defaultValue>${repoUrl}</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
        <hudson.model.StringParameterDefinition>
          <name>USER_EMAIL</name>
          <description>Email address for receiving reports</description>
          <defaultValue>${email}</defaultValue>
          <trim>true</trim>
        </hudson.model.StringParameterDefinition>
      </parameterDefinitions>
    </hudson.model.ParametersDefinitionProperty>
    <org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
      <triggers>
        <com.cloudbees.jenkins.GitHubPushTrigger plugin="github@1.34.1">
          <spec></spec>
        </com.cloudbees.jenkins.GitHubPushTrigger>
      </triggers>
    </org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition" plugin="workflow-cps@2.92">
    <script><![CDATA[
pipeline {
    agent any

    environment {
        SONAR_HOST_URL = 'http://13.60.90.186:9000'
        SONAR_AUTH_TOKEN = credentials('sonarqube')
        MONGO_URI = 'ec2-13-60-51-19.eu-north-1.compute.amazonaws.com'
        MONGO_DB = 'new_ai_code_suggestions_2'
        MONGO_COLLECTION = 'ML_analysis_results'
        SUGGESTION_COLLECTION = 'AI_Suggestions'
        SONAR_SCANNER_PATH = '/opt/sonar-scanner/bin'
        GEMINI_API_KEY = credentials('gemini_key')
    }

    stages {
        stage('Checkout Code') {
            steps {
                git branch: 'main', url: params.REPO_URL
            }
        }

        stage('Set Up Virtual Env & Install Dependencies') {
            steps {
                sh '''
                    python3 -m venv venv
                    . venv/bin/activate
                    pip install -r requirements.txt
                '''
            }
        }

        stage('Run Tests and Generate Coverage') {
            steps {
                sh '''
                    . venv/bin/activate
                    if [ -d "tests" ]; then
                        # Check if test_*.py OR sample_*.py files exist
                        if ls tests/test_*.py 1> /dev/null 2>&1 || ls tests/sample_*.py 1> /dev/null 2>&1; then
                            # Run coverage for test_*.py files if they exist
                            if ls tests/test_*.py 1> /dev/null 2>&1; then
                                coverage run -m unittest discover -s tests -p "test_*.py"
                            fi
                            # Run coverage for sample_*.py files if they exist (append mode)
                            if ls tests/sample_*.py 1> /dev/null 2>&1; then
                                coverage run -a -m unittest discover -s tests -p "sample_*.py"
                            fi
                            coverage xml -o coverage.xml
                        else
                            echo "⚠️ No test_*.py or sample_*.py files found in tests/ directory."
                            echo "<?xml version='1.0'?><coverage></coverage>" > coverage.xml
                        fi
                    else
                        echo "⚠️ No tests/ directory found. Skipping unit tests and coverage."
                        echo "<?xml version='1.0'?><coverage></coverage>" > coverage.xml
                    fi
                '''
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    withCredentials([string(credentialsId: 'sonarqube', variable: 'SONAR_TOKEN')]) {
                        sh '''
                            . venv/bin/activate
                            export PATH=\${SONAR_SCANNER_PATH}:\$PATH
                            sonar-scanner -Dsonar.login=\$SONAR_TOKEN
                        '''
                    }
                }
            }
        }

        stage('Sync to MongoDB') {
            steps {
                script {
                    def projectKey = sh(script: "grep '^sonar.projectKey=' sonar-project.properties | cut -d'=' -f2", returnStdout: true).trim()
                    def projectName = sh(script: "grep '^sonar.projectName=' sonar-project.properties | cut -d'=' -f2", returnStdout: true).trim()

                    def safeWorkspace = sh(script: 'echo \${WORKSPACE} | tr " " "_"', returnStdout: true).trim()
                    sh "mkdir -p \${safeWorkspace}/temp_results"
                    def jsonFile = "\${safeWorkspace}/temp_results/sonar_results.json"

                    echo "Using project key: \${projectKey}"
                    sleep 10

                    withCredentials([string(credentialsId: 'sonarqube', variable: 'SONAR_TOKEN')]) {
                        sh """
                            curl -u \${SONAR_TOKEN}: \
                            "\${SONAR_HOST_URL}/api/measures/component?component=\${projectKey}&metricKeys=\
code_smells,bugs,vulnerabilities,coverage,line_coverage,branch_coverage,\
duplicated_lines_density,duplicated_blocks,duplicated_lines,duplicated_files,\

sqale_index,sqale_rating,sqale_debt_ratio,\
reliability_rating,security_rating,security_review_rating,\
security_hotspots,security_hotspots_reviewed,\
complexity,cognitive_complexity,\
comment_lines,comment_lines_density,\
ncloc,lines,functions,classes,statements,files,\
tests,test_errors,test_failures,skipped_tests,test_success_density,\
alert_status" \
                            -o "\${jsonFile}"

                            if [ ! -s "\${jsonFile}" ]; then
                                echo "ERROR: Empty response from SonarQube API"
                                exit 1
                            fi
                        """
                    }

                    echo "SonarQube JSON contents:";
                    sh "cat \${jsonFile}"

                    echo "Syncing to MongoDB..."
                    sh """
                        . /home/ubuntu/mongoenv/bin/activate
                        export PROJECT_KEY="\${projectKey}"
                        export PROJECT_NAME="\${projectName}"
                        export MONGO_URI="\${MONGO_URI}"
                        export MONGO_DB="\${MONGO_DB}"
                        export MONGO_COLLECTION="\${MONGO_COLLECTION}"
                        export SONAR_JSON="\${jsonFile}"

                        python3 /home/ubuntu/sync_to_mongo.py
                    """
                }
            }
        }

        stage('Generate AI Suggestions') {
            steps {
                echo "🤖 Running AI Suggestion Generator..."
                sh '''
                    . /home/ubuntu/mongoenv/bin/activate
                    export SONAR_HOST_URL=\${SONAR_HOST_URL}
                    export SONAR_AUTH_TOKEN=\${SONAR_AUTH_TOKEN}
                    export SONAR_PROJECT_KEY=\$(grep '^sonar.projectKey=' sonar-project.properties | cut -d'=' -f2)
                    export MONGO_URI=\${MONGO_URI}
                    export MONGO_DB=\${MONGO_DB}
                    export MONGO_COLLECTION=\${SUGGESTION_COLLECTION}
                    export GEMINI_API_KEY=\${GEMINI_API_KEY}
                    export SONAR_JSON="\${WORKSPACE}/temp_results/sonar_results.json"

                    python3 /home/ubuntu/final_ai.py
                '''
            }
        }

        stage('Generate Email Body') {
            steps {
                script {
                    sh '''
                        . /home/ubuntu/mongoenv/bin/activate
                        pip install --quiet --disable-pip-version-check pandas
                        export SONAR_JSON="\${WORKSPACE}/temp_results/sonar_results.json"
                        python3 /home/ubuntu/generate_email_body.py
                    '''
                }
            }
        }

        stage('Send Email') {
            when {
                expression { currentBuild.result == null || currentBuild.result == 'SUCCESS' }
            }
            steps {
                script {
                    def emailOutputFile = "\${WORKSPACE}/temp_results/email_body.html"
                    def buildUrl = "\${env.BUILD_URL ?: "\${JENKINS_URL}job/\${JOB_NAME}/\${BUILD_NUMBER}/"}console"

                    def sonarProps = readFile('sonar-project.properties')
                    def projectNameMatch = sonarProps.split('\\n').find { it.startsWith('sonar.projectName=') }
                    def projectName = projectNameMatch ? projectNameMatch.split('=')[1].trim() : 'SonarQube Project'

                    def emailBody = readFile(emailOutputFile)

                    emailext(
                        subject: "✅ SonarQube Report - \${projectName} [Build #\${BUILD_NUMBER}]",
                        mimeType: 'text/html',
                        body: emailBody + "<br><br><a href='\${buildUrl}'>🔍 View Console Output</a>",
                        to: params.USER_EMAIL,
                        attachmentsPattern: 'ai_suggestions_report.xlsx'
                    )
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }

        success {
            echo "✅ Pipeline completed successfully!"
        }

        failure {
            script {
                def buildUrl = "\${env.BUILD_URL ?: "\${JENKINS_URL}job/\${JOB_NAME}/\${BUILD_NUMBER}/"}console"
                emailext(
                    subject: "❌ Jenkins Build Failed [Build #\${BUILD_NUMBER}]",
                    body: "Build failed. Please check Jenkins for details:<br><br><a href='\${buildUrl}'>🔍 View Console Output</a>",
                    mimeType: 'text/html',
                    to: params.USER_EMAIL
                )
            }
        }
    }
}
]]></script>
    <sandbox>true</sandbox>
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