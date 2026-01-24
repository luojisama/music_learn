import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'corrections.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim();
const GITHUB_REPO = process.env.GITHUB_REPO?.trim().replace(/^https:\/\/github\.com\//, '');
const GITHUB_BRANCH = process.env.GITHUB_BRANCH?.trim() || 'main';
const GITHUB_PATH = 'data/corrections.json';

// Helper for local file system
function readLocal() {
  if (!fs.existsSync(DATA_FILE)) {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeLocal(data: any) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Helper for GitHub API
async function fetchGitHub(method: 'GET'): Promise<{ content: any; sha: string; exists: boolean } | null>;
async function fetchGitHub(method: 'PUT', body: any): Promise<{ success: boolean; error?: string }>;
async function fetchGitHub(method: string, body?: any): Promise<any> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    const missing = [];
    if (!GITHUB_TOKEN) missing.push('GITHUB_TOKEN');
    if (!GITHUB_REPO) missing.push('GITHUB_REPO');
    console.warn(`[GitHub] Missing environment variables: ${missing.join(', ')}`);
    return null;
  }

  // Ensure repo is owner/repo format
  if (!GITHUB_REPO.includes('/')) {
    console.error(`[GitHub] Invalid GITHUB_REPO format: ${GITHUB_REPO}. Expected "owner/repo"`);
    return null;
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'Shiro-Music-App'
  };

  try {
    if (method === 'GET') {
      const fetchUrl = `${url}?ref=${GITHUB_BRANCH}`;
      const res = await fetch(fetchUrl, { headers, cache: 'no-store' });
      
      if (res.status === 404) {
        console.log(`[GitHub GET] File not found (404), will create new: ${GITHUB_PATH}`);
        return { content: {}, sha: '', exists: false };
      }
      
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[GitHub GET Error] ${res.status} on ${fetchUrl}: ${errText}`);
        return null;
      }
      
      const json = await res.json();
      const content = Buffer.from(json.content, 'base64').toString('utf-8');
      return { content: JSON.parse(content), sha: json.sha, exists: true };
    }

    if (method === 'PUT') {
      console.log(`[GitHub PUT] Updating ${GITHUB_PATH} on branch ${GITHUB_BRANCH} in ${GITHUB_REPO}...`);
      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[GitHub PUT Error] ${res.status}: ${errText}`);
        try {
          const errJson = JSON.parse(errText);
          return { success: false, error: errJson.message || errText };
        } catch {
          return { success: false, error: errText };
        }
      }
      
      return { success: true };
    }
  } catch (e: any) {
    console.error(`[GitHub API Exception]`, e);
    return { success: false, error: e.message || 'Network error' };
  }

  return null;
}

export async function GET() {
  try {
    if (GITHUB_TOKEN && GITHUB_REPO) {
      const githubData = await fetchGitHub('GET');
      if (githubData) {
        return NextResponse.json(githubData.content);
      }
    }
    return NextResponse.json(readLocal());
  } catch (error: any) {
    console.error('[GET /api/corrections] Error:', error);
    return NextResponse.json({ error: 'Failed to read corrections', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const correction = await req.json();
    const { songId } = correction;

    if (!songId) {
      return NextResponse.json({ error: 'songId is required' }, { status: 400 });
    }

    let data: any = {};
    let sha: string | undefined;
    const githubConfigured = !!(GITHUB_TOKEN && GITHUB_REPO);

    if (githubConfigured) {
      const githubData = await fetchGitHub('GET');
      if (githubData) {
        data = githubData.content;
        sha = githubData.sha;
      } else {
        return NextResponse.json({ 
          error: 'GitHub sync connection failed. Check Vercel logs for [GitHub GET Error].' 
        }, { status: 503 });
      }
    } else {
      data = readLocal();
    }

    // Update the specific song's correction
    data[songId] = {
      ...correction,
      updatedAt: Date.now(),
      isCorrected: true
    };

    if (githubConfigured) {
      const body: any = {
        message: `chore: update correction for song ${songId}`,
        content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
        branch: GITHUB_BRANCH
      };
      
      if (sha) {
        body.sha = sha;
      }

      const result = await fetchGitHub('PUT', body);
      if (!result?.success) {
        return NextResponse.json({ 
          error: `GitHub sync failed: ${result?.error || 'Unknown error'}`
        }, { status: 500 });
      }
    } else {
      writeLocal(data);
    }

    return NextResponse.json({ success: true, correction: data[songId] });
  } catch (error: any) {
    console.error('[POST /api/corrections] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
