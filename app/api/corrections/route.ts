import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'corrections.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // e.g. "username/repo"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
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
    console.warn('[GitHub] Missing GITHUB_TOKEN or GITHUB_REPO');
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
      const res = await fetch(`${url}?ref=${GITHUB_BRANCH}`, { headers, cache: 'no-store' });
      
      if (res.status === 404) {
        return { content: {}, sha: '', exists: false };
      }
      
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[GitHub GET Error] ${res.status}: ${errText}`);
        return null;
      }
      
      const json = await res.json();
      const content = Buffer.from(json.content, 'base64').toString('utf-8');
      return { content: JSON.parse(content), sha: json.sha, exists: true };
    }

    if (method === 'PUT') {
      console.log(`[GitHub PUT] Updating ${GITHUB_PATH} on branch ${GITHUB_BRANCH}...`);
      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[GitHub PUT Error] ${res.status}: ${errText}`);
        return { success: false, error: errText };
      }
      
      return { success: true };
    }
  } catch (e) {
    console.error(`[GitHub API Exception]`, e);
    return null;
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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read corrections' }, { status: 500 });
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
    let githubConfigured = !!(GITHUB_TOKEN && GITHUB_REPO);

    if (githubConfigured) {
      const githubData = await fetchGitHub('GET');
      if (githubData) {
        data = githubData.content;
        sha = githubData.sha;
      } else {
        // If GitHub is configured but GET failed (not a 404), stop to prevent data loss
        return NextResponse.json({ error: 'GitHub sync connection failed' }, { status: 503 });
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
      if (!result.success) {
        return NextResponse.json({ 
          error: 'GitHub sync failed', 
          details: result.error 
        }, { status: 500 });
      }
    } else {
      writeLocal(data);
    }

    return NextResponse.json({ success: true, correction: data[songId] });
  } catch (error) {
    console.error('[POST /api/corrections] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
