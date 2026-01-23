import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// 强制引入并导出，确保 Vercel 将它们打包到 Serverless 函数中且不被 Tree-shaking
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _forceDeps = {
  xml2js: require('xml2js'),
  cryptojs: require('crypto-js'),
  musicMetadata: require('music-metadata'),
  nodeForge: require('node-forge'),
  pacProxyAgent: require('pac-proxy-agent'),
  tunnel: require('tunnel'),
  yargs: require('yargs'),
  express: require('express'),
  expressFileupload: require('express-fileupload'),
  qrcode: require('qrcode'),
  md5: require('md5'),
  safeDecodeUriComponent: require('safe-decode-uri-component')
};

// 打印日志以确保依赖已加载（仅在开发环境或构建时可见）
if (process.env.NODE_ENV === 'development') {
  console.log('API Dependencies loaded:', Object.keys(_forceDeps));
}

// Use import for NeteaseCloudMusicApi to support ESM
import * as NeteaseModule from 'NeteaseCloudMusicApi';

// 兼容 ESM 和 CJS 的导出结构
const NeteaseCloudMusicApi = (NeteaseModule as any).default || NeteaseModule;

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

  // Handle Cookie and realIP
  const cookie = query.cookie || req.cookies.get('MUSIC_U')?.value || '';
  query.cookie = cookie;
  
  // 注入中国区 IP，防止 Vercel 海外服务器被网易云版权屏蔽或搜索结果差异
  if (!query.realIP) {
    query.realIP = '116.25.146.177'; 
  }

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
