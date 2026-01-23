import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Use require to avoid issues with NeteaseCloudMusicApi in serverless environments
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NeteaseCloudMusicApi = require('NeteaseCloudMusicApi');

interface QueryParams {
  cookie?: string;
  [key: string]: unknown;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handler(req, await params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handler(req, await params);
}

async function handler(req: NextRequest, params: { path: string[] }) {
  const { path } = params;
  // Convert path array to snake_case method name
  const endpoint = path.join('_');

  // Find the method in the API object
  // Sometimes methods are nested or named differently in the package
  let method = NeteaseCloudMusicApi[endpoint];
  
  // Special case for some common endpoints that might be nested
  if (!method) {
    // Try to find the method in a case-insensitive way or with other patterns
    const keys = Object.keys(NeteaseCloudMusicApi);
    const foundKey = keys.find(k => k.toLowerCase() === endpoint.toLowerCase());
    if (foundKey) {
      method = NeteaseCloudMusicApi[foundKey];
    }
  }

  if (typeof method !== 'function') {
    console.error(`Endpoint not found: ${endpoint}`);
    return NextResponse.json({ code: 404, msg: `Endpoint ${endpoint} not found` }, { status: 404 });
  }

  // Parse Query Parameters
  const url = new URL(req.url);
  const query: QueryParams = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Parse Body for POST
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      Object.assign(query, body);
    } catch {
      // Ignore JSON parse error
    }
  }

  // Handle Cookie
  const cookie = query.cookie || req.cookies.get('MUSIC_U')?.value || '';
  query.cookie = cookie;

  try {
    const result = await method(query);
    
    const response = NextResponse.json(result.body, { status: result.status });

    if (result.cookie) {
       if (Array.isArray(result.cookie)) {
         result.cookie.forEach((c: string) => {
           response.headers.append('Set-Cookie', c);
         });
       }
    }

    return response;
  } catch (error: any) {
    console.error(`API Error for ${endpoint}:`, error);
    const status = error?.status || 500;
    const body = error?.body || { code: status, msg: error?.message || 'Internal Server Error' };
    return NextResponse.json(body, { status });
  }
}
