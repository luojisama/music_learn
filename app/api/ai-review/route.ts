import { NextRequest, NextResponse } from 'next/server';

const AI_API_URL = process.env.AI_API_URL?.trim().replace(/\/$/, '');
const AI_API_KEY = process.env.AI_API_KEY?.trim();
const AI_MODEL = process.env.AI_MODEL?.trim() || 'gpt-4o-mini';

// Keep small — Vercel hobby functions time out at 10 s, Pro at 60 s
const BATCH_SIZE = 20;

interface ReviewItem {
  index: number;
  text: string;
  romaji: string;
}

export interface ReviewResult {
  index: number;
  approved: boolean;
  suggestion?: string;
  comment?: string;
}

/** Strip markdown code fences, then extract first JSON array or object. */
function extractJson(raw: string): unknown {
  const stripped = raw
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  for (const text of [stripped, raw]) {
    try { return JSON.parse(text); } catch { /* continue */ }

    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]); } catch { /* continue */ }
    }

    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { /* continue */ }
    }
  }

  throw new Error(`无法解析 AI 响应为 JSON。内容片段：${raw.slice(0, 200)}`);
}

export async function POST(req: NextRequest) {
  if (!AI_API_URL || !AI_API_KEY) {
    const missing: string[] = [];
    if (!AI_API_URL) missing.push('AI_API_URL');
    if (!AI_API_KEY) missing.push('AI_API_KEY');
    return NextResponse.json(
      { error: 'AI 审核未配置', details: `请在 Vercel 环境变量中设置: ${missing.join(', ')}` },
      { status: 503 }
    );
  }

  let items: ReviewItem[] = [];
  let lang = 'ja';
  try {
    const body = await req.json() as { items: ReviewItem[]; lang: string };
    items = body.items ?? [];
    lang = body.lang ?? 'ja';
  } catch {
    return NextResponse.json({ error: '请求体解析失败' }, { status: 400 });
  }

  if (items.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const batchItems = items.slice(0, BATCH_SIZE);
  const langName = lang === 'zh' ? '中文拼音' : '日语罗马音（Romaji）';

  const systemPrompt = `你是${langName}转写审核专家。只输出 JSON 数组，不要任何说明文字或代码块标记：
[{"index":数字,"approved":布尔值,"suggestion":"建议转写，仅错误时填","comment":"不超过15字，仅错误时填"}]

审核标准：
- 符合 Hepburn 罗马字规范
- 粒子：は→wa，を→o，へ→e
- 长音、促音处理正确
- 整体可接受（细微差异如长音线）也判为 approved:true`;

  const userPrompt = `审核以下歌词${langName}：${JSON.stringify(batchItems)}`;

  let aiRaw = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28000);

    const response = await fetch(`${AI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI Review] upstream error:', response.status, errText);
      return NextResponse.json(
        { error: `AI API 返回错误 (${response.status})`, details: errText.slice(0, 400) },
        { status: 502 }
      );
    }

    const data = await response.json();
    aiRaw = (data.choices?.[0]?.message?.content as string | undefined) ?? '';

    if (!aiRaw) {
      return NextResponse.json(
        { error: 'AI 返回空响应', details: JSON.stringify(data).slice(0, 300) },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('abort') || msg.toLowerCase().includes('timeout');
    console.error('[AI Review] fetch error:', msg);
    return NextResponse.json(
      {
        error: isTimeout
          ? '审核超时，请减少歌词行数后重试'
          : `请求 AI 失败: ${msg}`,
      },
      { status: 502 }
    );
  }

  try {
    const parsed = extractJson(aiRaw);
    const results: ReviewResult[] = Array.isArray(parsed)
      ? (parsed as ReviewResult[])
      : ((parsed as { results?: ReviewResult[] }).results ?? []);
    return NextResponse.json({ results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AI Review] parse error:', msg);
    return NextResponse.json(
      { error: 'AI 响应解析失败', details: msg },
      { status: 500 }
    );
  }
}
