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
async function fetchGitHub(method: string, body?: any) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=${GITHUB_BRANCH}`;
  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'Shiro-Music-App'
  };

  if (method === 'GET') {
    const res = await fetch(url, { headers, next: { revalidate: 0 } });
    if (!res.ok) return null;
    const json = await res.json();
    const content = Buffer.from(json.content, 'base64').toString('utf-8');
    return { content: JSON.parse(content), sha: json.sha };
  }

  if (method === 'PUT') {
    const res = await fetch(url.split('?')[0], {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });
    return res.ok;
  }

  return null;
}

export async function GET() {
  try {
    // If GitHub config is present, try GitHub first
    if (GITHUB_TOKEN && GITHUB_REPO) {
      const githubData = await fetchGitHub('GET');
      if (githubData) {
        return NextResponse.json(githubData.content);
      }
    }
    
    // Fallback to local
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

    let data: any;
    let sha: string | undefined;

    // Try GitHub first if configured
    if (GITHUB_TOKEN && GITHUB_REPO) {
      const githubData = await fetchGitHub('GET');
      if (githubData) {
        data = githubData.content;
        sha = githubData.sha;
      }
    }

    // Fallback/Local logic
    if (!data) {
      data = readLocal();
    }

    data[songId] = {
      ...correction,
      updatedAt: Date.now(),
      isCorrected: true
    };

    // Save to GitHub if configured
    if (GITHUB_TOKEN && GITHUB_REPO && sha) {
      const success = await fetchGitHub('PUT', {
        message: `chore: update correction for song ${songId}`,
        content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
        sha,
        branch: GITHUB_BRANCH
      });
      if (!success) {
        throw new Error('GitHub sync failed');
      }
    } else {
      // Otherwise save locally (dev mode or no GitHub config)
      writeLocal(data);
    }

    return NextResponse.json({ success: true, correction: data[songId] });
  } catch (error) {
    console.error('Correction save error:', error);
    return NextResponse.json({ error: 'Failed to save correction' }, { status: 500 });
  }
}
