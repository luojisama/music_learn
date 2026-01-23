import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// 强制引入依赖，确保 Vercel 将它们打包到 Serverless 函数中
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _forceDeps = [
  require('xml2js'),
  require('crypto-js'),
  require('music-metadata'),
  require('node-forge'),
  require('pac-proxy-agent'),
  require('tunnel'),
  require('yargs'),
  require('express'),
  require('express-fileupload')
];

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
  let method = NeteaseCloudMusicApi[endpoint];
  
  if (!method) {
    const keys = Object.keys(NeteaseCloudMusicApi);
    // 尝试下划线转驼峰 (例如 cloud_search -> cloudsearch)
    const camelEndpoint = endpoint.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const foundKey = keys.find(k => 
      k.toLowerCase() === endpoint.replace(/_/g, '').toLowerCase() || 
      k.toLowerCase() === camelEndpoint.toLowerCase()
    );
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
