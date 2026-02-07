// api/create-job.js
const JENKINS_URL = process.env.JENKINS_URL || "http://51.20.32.30:8080";
const JENKINS_USER = process.env.JENKINS_USER || "vercel-deployer";
const JENKINS_API_TOKEN = process.env.JENKINS_API_TOKEN || "11c91008d123dd22189e5e7fd20894ee5b";

function basicAuthHeader() {
  const credentials = `${JENKINS_USER}:${JENKINS_API_TOKEN}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

function generateJobConfig(repoUrl, email) {
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
        SONAR_HOST_URL = 'http://51.20.184.142:9000'
        SONAR_AUTH_TOKEN = credentials('sonarqube')
        MONGO_URI = 'ec2-16-171-140-113.eu-north-1.compute.amazonaws.com:27017'
        MONGO_DB = 'SDP_2026'
        REPO_NAME = sh(script: "echo \${params.REPO_URL} | sed 's#.*/##' | sed 's#\\\\.git\\\$##' | tr -cd '[:alnum:]_-'", returnStdout: true).trim()
        MONGO_COLLECTION = "\${REPO_NAME}_sonar_analysis"
        SUGGESTION_COLLECTION = "\${REPO_NAME}_AI_Suggestions"
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
                    def buildUrl = "\${env.BUILD_URL}"

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
                def buildUrl = "\${env.BUILD_URL}"
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
}

async function getCrumb() {
  const crumbUrl = `${JENKINS_URL}/crumbIssuer/api/json`;
  const response = await fetch(crumbUrl, {
    headers: {
      Authorization: basicAuthHeader(),
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Crumb fetch failed: ${response.status}`);
  }

  return await response.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const { jobName, repoUrl, email } = body;

    if (!jobName || !repoUrl || !email) {
      return res.status(400).json({ error: 'jobName, repoUrl, and email are required' });
    }

    const jobConfig = generateJobConfig(repoUrl, email);
    const crumb = await getCrumb().catch(() => null);

    const headers = {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/xml',
    };

    if (crumb && crumb.crumbRequestField) {
      headers[crumb.crumbRequestField] = crumb.crumb;
    }

    const encodedJobName = encodeURIComponent(jobName);
    const createUrl = `${JENKINS_URL}/createItem?name=${encodedJobName}`;

    const response = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: jobConfig,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create job: ${response.status} ${errorText}`);
    }

    return res.status(200).json({ success: true, jobName });
  } catch (error) {
    console.error('create-job error:', error);
    return res.status(500).json({ 
      success: false, 
      error: String(error && error.message ? error.message : error) 
    });
  }
}
