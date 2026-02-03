// api/trigger.js
const JENKINS_URL = process.env.JENKINS_URL || "http://56.228.23.50:8080";
const JENKINS_USER = process.env.JENKINS_USER || "vercel-deployer";
const JENKINS_API_TOKEN = process.env.JENKINS_API_TOKEN || "11c91008d123dd22189e5e7fd20894ee5b";

function basicAuthHeader() {
  const credentials = `${JENKINS_USER}:${JENKINS_API_TOKEN}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse JSON:', text.substring(0, 200));
    }
    
    return { ok: res.ok, status: res.status, json, text };
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

async function getCrumb() {
  try {
    const r = await fetchJson(`${JENKINS_URL}/crumbIssuer/api/json`, { 
      headers: { Authorization: basicAuthHeader() } 
    });
    
    if (r.status === 404) return null; // crumb issuer disabled
    if (!r.ok) {
      console.error(`Crumb fetch failed: ${r.status} ${r.text}`);
      return null; // Return null instead of throwing to continue without crumb
    }
    return r.json;
  } catch (error) {
    console.error('Error getting crumb:', error);
    return null; // Continue without crumb if there's an error
  }
}

async function triggerBuildAndWait(jobName, params = {}) {
  const encodedJob = encodeURIComponent(jobName);
  const search = new URLSearchParams(params).toString();
  const buildUrl = `${JENKINS_URL}/job/${encodedJob}/buildWithParameters${search ? "?" + search : ""}`;

  console.log('Triggering build:', buildUrl);

  const crumb = await getCrumb().catch(() => null);
  const headers = { Authorization: basicAuthHeader() };
  if (crumb && crumb.crumbRequestField) {
    headers[crumb.crumbRequestField] = crumb.crumb;
  }

  const resp = await fetch(buildUrl, { method: "POST", headers, redirect: "manual" });
  
  if (![200, 201, 302].includes(resp.status)) {
    const t = await resp.text();
    console.error(`Trigger failed: ${resp.status} ${t}`);
    throw new Error(`Trigger failed: ${resp.status} ${t.substring(0, 200)}`);
  }

  const location = resp.headers.get("location");
  if (!location) {
    const jobInfo = await fetchJson(`${JENKINS_URL}/job/${encodedJob}/api/json`, { headers });
    return { buildNumber: jobInfo.json?.nextBuildNumber || null, queueLocation: null };
  }

  const m = location.match(/\/queue\/item\/(\d+)/);
  if (!m) return { buildNumber: null, queueLocation: location };

  const qid = m[1];
  for (let i = 0; i < 30; i++) {
    const qi = await fetchJson(`${JENKINS_URL}/queue/item/${qid}/api/json`, { headers });
    if (qi.ok && qi.json && qi.json.executable && qi.json.executable.number) {
      return { buildNumber: qi.json.executable.number, queueLocation: location };
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  return { buildNumber: null, queueLocation: location, warning: "timed out waiting" };
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json'); // Ensure JSON response

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Only POST allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const jobName = body.jobName || body.repoName || "git-sonar-gen";
    const params = body.params || { REPO_URL: body.repoUrl || "", USER_EMAIL: body.email || "" };

    console.log('Triggering build for job:', jobName, 'with params:', params);

    const result = await triggerBuildAndWait(jobName, params);
    return res.status(200).json({ success: true, jobName, ...result });
  } catch (err) {
    console.error("trigger error:", err && err.stack || err);
    return res.status(500).json({ 
      success: false, 
      error: String(err && err.message ? err.message : err) 
    });
  }
}
