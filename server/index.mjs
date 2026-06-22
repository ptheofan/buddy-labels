import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const appVersion = String(packageJson.version || '0.0.0');

function loadDotEnv() {
  const envPath = path.join(projectRoot, '.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadDotEnv();

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json());

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeGithubRepository(value) {
  let raw = '';
  if (typeof value === 'string') {
    raw = value;
  } else if (value && typeof value === 'object' && typeof value.url === 'string') {
    raw = value.url;
  }

  raw = raw.trim().replace(/^git\+/, '').replace(/\.git$/, '');
  const sshMatch = /^git@github\.com:([^/]+\/[^/]+)$/.exec(raw);
  if (sshMatch) return sshMatch[1];

  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw)) return raw;

  try {
    const url = new URL(raw);
    if (url.hostname !== 'github.com') return '';
    const [owner, repo] = url.pathname.replace(/^\/+/, '').replace(/\.git$/, '').split('/');
    return owner && repo ? `${owner}/${repo}` : '';
  } catch {
    return '';
  }
}

function appGithubRepository() {
  return normalizeGithubRepository(
    process.env.APP_GITHUB_REPOSITORY ||
      process.env.VITE_GITHUB_REPOSITORY ||
      process.env.GITHUB_REPOSITORY ||
      packageJson.repository,
  );
}

function bambuddyHeaders() {
  const apiKey = String(process.env.BAMBUDDY_API_KEY || '').trim();
  const bearerToken = String(process.env.BAMBUDDY_BEARER_TOKEN || '').trim();
  const headers = {
    Accept: 'application/json',
  };

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  return headers;
}

async function requestBambuddy(path) {
  const baseUrl = normalizeBaseUrl(process.env.BAMBUDDY_URL);
  if (!baseUrl) {
    const err = new Error('BAMBUDDY_URL is not configured');
    err.status = 400;
    throw err;
  }

  const url = `${baseUrl}/api/v1${path}`;
  const response = await fetch(url, {
    headers: bambuddyHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(body || `Bambuddy returned HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

function sendError(res, err) {
  const status = Number(err.status || 500);
  res.status(status).json({
    error: err.message || 'Unexpected proxy error',
    status,
  });
}

app.get('/api/config', async (_req, res) => {
  const configuredBaseUrl = normalizeBaseUrl(process.env.BAMBUDDY_URL);
  let externalUrl = '';
  let connected = false;
  let settingsError = '';

  if (configuredBaseUrl) {
    try {
      const settings = await requestBambuddy('/settings/');
      externalUrl = normalizeBaseUrl(settings.external_url || '');
      connected = true;
    } catch (err) {
      settingsError = err.message || 'Could not read Bambuddy settings';
    }
  }

  res.json({
    configured: Boolean(configuredBaseUrl),
    connected,
    baseUrl: configuredBaseUrl,
    externalUrl,
    qrBaseUrl: externalUrl || configuredBaseUrl,
    hasApiKey: Boolean(process.env.BAMBUDDY_API_KEY || process.env.BAMBUDDY_BEARER_TOKEN),
    settingsError,
    appVersion,
    githubRepository: appGithubRepository(),
  });
});

app.get('/api/spools', async (req, res) => {
  const source = req.query.source === 'spoolman' ? 'spoolman' : 'local';
  const includeArchived = req.query.includeArchived === 'true';
  const query = includeArchived ? '?include_archived=true' : '';
  const path =
    source === 'spoolman'
      ? `/spoolman/inventory/spools${query}`
      : `/inventory/spools${query}`;

  try {
    const spools = await requestBambuddy(path);
    res.json({ source, spools });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await requestBambuddy('/settings/');
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

if (existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || req.path.startsWith('/api') || !req.accepts('html')) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Buddy Labels listening on http://0.0.0.0:${port}`);
});
