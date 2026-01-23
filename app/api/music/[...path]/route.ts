import { NextRequest, NextResponse } from 'next/server';
import * as NeteaseCloudMusicApi from 'NeteaseCloudMusicApi';

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
  // e.g., /api/music/search -> search
  // e.g., /api/music/song/url -> song_url
  const endpoint = path.join('_');

  if (!NeteaseCloudMusicApi[endpoint]) {
    return NextResponse.json({ code: 404, msg: 'Endpoint not found' }, { status: 404 });
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
      // Ignore JSON parse error if body is empty
    }
  }

  // Handle Cookie
  // Check if cookie is passed in query or request headers
  const cookie = query.cookie || req.cookies.get('MUSIC_U')?.value || '';
  // If user passed a cookie in the header 'Cookie', we might want to use it
  // But NeteaseCloudMusicApi expects it in the query object usually.

  query.cookie = cookie;

  try {
    const result = await NeteaseCloudMusicApi[endpoint](query);
    
    // Create Response
    const response = NextResponse.json(result.body, { status: result.status });

    // Handle Set-Cookie if present in the result
    if (result.cookie) {
       // result.cookie is usually an array of strings
       if (Array.isArray(result.cookie)) {
         result.cookie.forEach((c: string) => {
           response.headers.append('Set-Cookie', c);
         });
       }
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { code: 500, msg: message, error },
      { status: 500 }
    );
  }
}
