// api/check-job.js
const JENKINS_URL = process.env.JENKINS_URL || "http://56.228.23.50:8080";
const JENKINS_USER = process.env.JENKINS_USER || "vercel-deployer";
const JENKINS_API_TOKEN = process.env.JENKINS_API_TOKEN || "11c91008d123dd22189e5e7fd20894ee5b";

function basicAuthHeader() {
  const credentials = `${JENKINS_USER}:${JENKINS_API_TOKEN}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const jobName = body.jobName;

    if (!jobName) {
      return res.status(400).json({ error: 'jobName is required', exists: false });
    }

    console.log(`[check-job] Checking job: ${jobName}`);

    const encodedJobName = encodeURIComponent(jobName);
    const jobUrl = `${JENKINS_URL}/job/${encodedJobName}/api/json`;

    const response = await fetch(jobUrl, {
      method: 'GET',
      headers: {
        Authorization: basicAuthHeader(),
      },
    });

    const exists = response.ok;
    console.log(`[check-job] Job ${jobName} exists: ${exists}`);
    
    return res.status(200).json({ exists });
  } catch (error) {
    console.error('[check-job] Error:', error);
    return res.status(500).json({ 
      exists: false, 
      error: String(error && error.message ? error.message : error) 
    });
  }
}
