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

const JAPANESE_NUMS = ['zero', 'ichi', 'ni', 'san', 'yon', 'go', 'roku', 'nana', 'hachi', 'kyuu'];

// Common song-specific readings or corrections for kuroshiro/kuromoji
const ROMAJI_CORRECTIONS: { [key: string]: string } = {
  'は': 'wa', // As a particle
  'を': 'wo',
  'へ': 'e',
  // Add more as needed, but be careful with global replacements
};

function numberToJapaneseRomaji(n: number): string {
  if (n === 0) return 'zero';
  if (n < 10) return JAPANESE_NUMS[n];
  if (n < 20) return 'juu' + (n % 10 === 0 ? '' : ' ' + JAPANESE_NUMS[n % 10]);
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const one = n % 10;
    const tenPrefix = ten === 1 ? '' : JAPANESE_NUMS[ten] + ' ';
    return tenPrefix + 'juu' + (one === 0 ? '' : ' ' + JAPANESE_NUMS[one]);
  }
  if (n < 1000) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let prefix = hundred === 1 ? '' : JAPANESE_NUMS[hundred] + ' ';
    // Simplified hyaku for lyrics
    return prefix + 'hyaku' + (rest === 0 ? '' : ' ' + numberToJapaneseRomaji(rest));
  }
  if (n < 10000) {
    const thousand = Math.floor(n / 1000);
    const rest = n % 1000;
    let prefix = thousand === 1 ? '' : JAPANESE_NUMS[thousand] + ' ';
    return prefix + 'sen' + (rest === 0 ? '' : ' ' + numberToJapaneseRomaji(rest));
  }
  return n.toString();
}

function convertNumbersToRomaji(text: string): string {
  // Use a word boundary check to avoid replacing numbers inside other strings if possible
  // but in romaji "123" is usually separated by spaces.
  return text.replace(/\b\d+\b/g, (match) => {
    const n = parseInt(match, 10);
    if (!isNaN(n) && n < 10000) {
      return numberToJapaneseRomaji(n);
    }
    return match;
  });
}

function applyRomajiCorrections(text: string): string {
  let result = text;

  // Strip Unicode diacritics produced by Hepburn romanization
  // e.g. ō→o, ū→u, ā→a, ī→i, ē→e  (NFD decompose then remove combining marks)
  result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Apply specific corrections for common particles or song readings
  // that kuromoji often gets wrong in "spaced" mode
  const corrections: { [key: string]: string } = {
    ' ha ': ' wa ',
    ' wo ': ' o ',
    ' he ': ' e ',
  };

  Object.entries(corrections).forEach(([old, curr]) => {
    result = result.replace(new RegExp(old, 'g'), curr);
  });

  return result.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { text, lang, furigana } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (lang === 'zh') {
      // Chinese -> Pinyin
      const result = pinyin(text, { toneType: 'none', type: 'string', v: true });
      return NextResponse.json({ result });
    } else {
      // Japanese
      try {
        const k = await initKuroshiro();

        if (furigana) {
          // Generate furigana and romaji in parallel from the same kuroshiro instance
          const [rawFurigana, rawRomaji] = await Promise.all([
            k.convert(text, { to: 'hiragana', mode: 'furigana' }),
            k.convert(text, { to: 'romaji', mode: 'spaced' }),
          ]);

          // Add <rp> fallback tags to furigana HTML
          const result = rawFurigana.replace(
            /<ruby>([^<]*)<rt>([^<]*)<\/rt><\/ruby>/g,
            '<ruby>$1<rp>(</rp><rt>$2</rt><rp>)</rp></ruby>'
          );

          // Return aligned romaji so caller can sync both fields at once
          const romaji = applyRomajiCorrections(convertNumbersToRomaji(rawRomaji));
          return NextResponse.json({ result, romaji });
        }

        // 1. Convert to Romaji
        let result = await k.convert(text, { to: 'romaji', mode: 'spaced' });

        // 2. Convert Arabic numerals to Romaji
        result = convertNumbersToRomaji(result);

        // 3. Apply manual corrections if any
        result = applyRomajiCorrections(result);

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
