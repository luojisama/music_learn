import { NextRequest, NextResponse } from 'next/server';
import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';
import { pinyin } from 'pinyin-pro';
import path from 'path';

// Initialize Kuroshiro lazily
type KuroshiroInstance = InstanceType<typeof Kuroshiro>;
type KuromojiAnalyzerInstance = InstanceType<typeof KuromojiAnalyzer>;

let kuroshiro: KuroshiroInstance | null = null;
let analyzer: KuromojiAnalyzerInstance | null = null;

async function initKuroshiro(): Promise<KuroshiroInstance> {
  if (!kuroshiro) {
    kuroshiro = new Kuroshiro();
    // Kuromoji needs a dictionary path. 
    // In Vercel serverless, we might need to point to node_modules or a public URL.
    // However, KuromojiAnalyzer by default looks for local files.
    // For simplicity in this demo, we assume standard node setup. 
    // In production Vercel, copying dict files might be needed or use a CDN.
    // Let's try standard initialization.
    analyzer = new KuromojiAnalyzer({
        dictPath: path.join(process.cwd(), 'node_modules', 'kuromoji', 'dict')
    });
    await kuroshiro.init(analyzer);
  }
  return kuroshiro;
}

export async function POST(req: NextRequest) {
  try {
    const { text, lang } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (lang === 'zh') {
      // Chinese -> Pinyin
      const result = pinyin(text, { toneType: 'none', type: 'string', v: true });
      return NextResponse.json({ result });
    } else {
      // Japanese -> Romaji (default)
      try {
        const k = await initKuroshiro();
        const result = await k.convert(text, { to: 'romaji', mode: 'spaced' });
        return NextResponse.json({ result });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to convert Japanese';
        return NextResponse.json({ error: 'Failed to convert Japanese', details: message }, { status: 500 });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
