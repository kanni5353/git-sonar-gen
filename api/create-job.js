sh '''
export PATH=\${SONAR_SCANNER_PATH}:\$PATH
sonar-scanner -Dsonar.login=\$SONAR_TOKEN

# Other content ...

export SONAR_HOST_URL=\${SONAR_HOST_URL}
export SONAR_AUTH_TOKEN=\${SONAR_AUTH_TOKEN}
export SONAR_PROJECT_KEY=\$(grep
export MONGO_URI=\${MONGO_URI}
export MONGO_DB=\${MONGO_DB}
export MONGO_COLLECTION=\${SUGGESTION_COLLECTION}
export GEMINI_API_KEY=\${GEMINI_API_KEY}
export SONAR_JSON="\${WORKSPACE}/temp_results/sonar_results.json"

# More content...

export SONAR_JSON="\${WORKSPACE}/temp_results/sonar_results.json"
'''