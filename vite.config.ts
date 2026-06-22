import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

function normalizeGithubRepository(value: unknown): string {
  let raw = '';
  if (typeof value === 'string') {
    raw = value;
  } else if (value && typeof value === 'object' && 'url' in value) {
    raw = String((value as { url?: unknown }).url || '');
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

const defaultGithubRepository = normalizeGithubRepository(
  process.env.VITE_GITHUB_REPOSITORY || process.env.APP_GITHUB_REPOSITORY || packageJson.repository,
);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __DEFAULT_GITHUB_REPOSITORY__: JSON.stringify(defaultGithubRepository),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});
