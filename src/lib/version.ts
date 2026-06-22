export interface LatestReleaseInfo {
  version: string;
  tagName: string;
  url: string;
}

export const CURRENT_APP_VERSION = __APP_VERSION__;

const defaultGithubRepository = normalizeGithubRepository(__DEFAULT_GITHUB_REPOSITORY__);

export function resolveVersionRepository(configRepository?: string | null): string {
  return normalizeGithubRepository(configRepository) || defaultGithubRepository;
}

export async function fetchLatestReleaseInfo(repository: string, signal?: AbortSignal): Promise<LatestReleaseInfo> {
  const normalizedRepository = normalizeGithubRepository(repository);
  if (!normalizedRepository) throw new Error('GitHub repository is not configured');

  const [owner, repo] = normalizedRepository.split('/');
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
    signal,
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error('No GitHub release found');
    throw new Error(`Version check failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    tag_name?: string;
    html_url?: string;
    name?: string;
  };
  const tagName = String(payload.tag_name || payload.name || '').trim();
  const version = cleanVersion(tagName);
  if (!version) throw new Error('Latest release does not have a semver tag');

  return {
    version,
    tagName,
    url: String(payload.html_url || `https://github.com/${normalizedRepository}/releases/latest`),
  };
}

export function isNewerVersion(latestVersion: string, currentVersion = CURRENT_APP_VERSION): boolean {
  return compareSemver(latestVersion, currentVersion) > 0;
}

function normalizeGithubRepository(value?: string | null): string {
  const raw = String(value || '').trim();
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw)) return raw;

  const withoutGitPrefix = raw.replace(/^git\+/, '').replace(/\.git$/, '');
  const sshMatch = /^git@github\.com:([^/]+\/[^/]+)$/.exec(withoutGitPrefix);
  if (sshMatch) return sshMatch[1];

  try {
    const url = new URL(withoutGitPrefix);
    if (url.hostname !== 'github.com') return '';
    const [owner, repo] = url.pathname.replace(/^\/+/, '').replace(/\.git$/, '').split('/');
    return owner && repo ? `${owner}/${repo}` : '';
  } catch {
    return '';
  }
}

function cleanVersion(value: string): string {
  const match = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/.exec(value.trim());
  return match?.[1] || '';
}

function compareSemver(left: string, right: string): number {
  const parsedLeft = parseSemver(left);
  const parsedRight = parseSemver(right);
  if (!parsedLeft || !parsedRight) return 0;

  for (let index = 0; index < 3; index += 1) {
    const diff = parsedLeft.numbers[index] - parsedRight.numbers[index];
    if (diff !== 0) return diff;
  }

  if (parsedLeft.prerelease === parsedRight.prerelease) return 0;
  if (!parsedLeft.prerelease) return 1;
  if (!parsedRight.prerelease) return -1;
  return parsedLeft.prerelease.localeCompare(parsedRight.prerelease);
}

function parseSemver(value: string): { numbers: [number, number, number]; prerelease: string } | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value.trim());
  if (!match) return null;
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] || '',
  };
}
