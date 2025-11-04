// api/trigger.js
const JENKINS_URL = process.env.JENKINS_URL || "http://13.61.15.150:8080";
const JENKINS_USER = process.env.JENKINS_USER || "vercel-deployer";
const JENKINS_API_TOKEN = process.env.JENKINS_API_TOKEN || "11c91008d123dd22189e5e7fd20894ee5b";

function basicAuthHeader() {
  const credentials = `${JENKINS_USER}:${JENKINS_API_TOKEN}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

async function fetchJson(url, options = {}) {
const res = await fetch(url, options);
const text = await res.text();
try { return { ok: res.ok, status: res.status, json: JSON.parse(text), text }; }
catch { return { ok: res.ok, status: res.status, text }; }
}


async function getCrumb() {
const r = await fetchJson(`${JENKINS_URL}/crumbIssuer/api/json`, { headers: { Authorization: basicAuthHeader() } });
if (r.status === 404) return null; // crumb issuer disabled
if (!r.ok) throw new Error(`Crumb fetch failed: ${r.status} ${r.text}`);
return r.json;
}


async function triggerBuildAndWait(jobName, params = {}) {
const encodedJob = encodeURIComponent(jobName);
const search = new URLSearchParams(params).toString();
const buildUrl = `${JENKINS_URL}/job/${encodedJob}/buildWithParameters${search ? "?" + search : ""}`;


const crumb = await getCrumb().catch(() => null);
const headers = { Authorization: basicAuthHeader() };
if (crumb && crumb.crumbRequestField) headers[crumb.crumbRequestField] = crumb.crumb;


const resp = await fetch(buildUrl, { method: "POST", headers, redirect: "manual" });
if (![200,201,302].includes(resp.status)) {
const t = await resp.text();
throw new Error(`Trigger failed: ${resp.status} ${t}`);
}


const location = resp.headers.get("location");
if (!location) {
const jobInfo = await fetchJson(`${JENKINS_URL}/job/${encodedJob}/api/json`, { headers });
return { buildNumber: jobInfo.json?.nextBuildNumber || null, queueLocation: null };
}


const m = location.match(/\/queue\/item\/(\d+)/);
if (!m) return { buildNumber: null, queueLocation: location };


const qid = m[1];
for (let i=0;i<30;i++) {
const qi = await fetchJson(`${JENKINS_URL}/queue/item/${qid}/api/json`, { headers });
if (qi.ok && qi.json && qi.json.executable && qi.json.executable.number) {
return { buildNumber: qi.json.executable.number, queueLocation: location };
}
await new Promise(r => setTimeout(r, 1000));
}
return { buildNumber: null, queueLocation: location, warning: "timed out waiting" };
}


export default async function handler(req, res) {
if (req.method !== "POST") return res.status(405).send("Only POST allowed");
try {
const body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
const jobName = body.jobName || body.repoName || "git-sonar-gen";
const params = body.params || { REPO_URL: body.repoUrl || "", USER_EMAIL: body.email || "" };


const result = await triggerBuildAndWait(jobName, params);
return res.status(200).json({ success: true, jobName, ...result });
} catch (err) {
console.error("trigger error:", err && err.stack || err);
return res.status(500).json({ success: false, error: String(err && err.message ? err.message : err) });
}
}
