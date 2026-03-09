import { NextRequest, NextResponse } from 'next/server';

const AI_API_URL = process.env.AI_API_URL?.trim().replace(/\/$/, '');
const AI_API_KEY = process.env.AI_API_KEY?.trim();
const AI_MODEL = process.env.AI_MODEL?.trim() || 'gpt-4o-mini';

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

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]); } catch { /* continue */ }
    }
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { /* continue */ }
    }
    throw new Error('无法从 AI 响应中提取 JSON');
  }
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

  try {
    const { items, lang } = await req.json() as { items: ReviewItem[]; lang: string };

    if (!items || items.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const batchItems = items.slice(0, 60);
    const langName = lang === 'zh' ? '中文拼音' : '日语罗马音（Romaji）';

    const systemPrompt = `你是一个${langName}转写审核专家，专门审核日语歌词的罗马音转写准确性。
请严格按照以下 JSON 数组格式返回结果，不要有任何额外说明或 markdown 代码块：
[{"index": 数字, "approved": 布尔值, "suggestion": "建议转写（仅当 approved 为 false 时填写）", "comment": "简短说明（仅当 approved 为 false 时填写，不超过20字）"}]

审核标准：
- 罗马音拼写是否符合 Hepburn 罗马字规范
- 粒子读音：は→wa，を→o，へ→e
- 常见长音、促音处理是否正确
- 整体是否能准确表示该歌词的日语发音
- 如果转写基本正确但存在细微差异（如长音标注方式），也可以批准`;

    const userPrompt = `请审核以下歌词的${langName}转写是否正确：\n${JSON.stringify(batchItems)}`;

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
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI Review] API error:', response.status, errText);
      return NextResponse.json(
        { error: `AI API 返回错误 (${response.status})`, details: errText },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content as string | undefined;

    if (!content) {
      return NextResponse.json({ error: 'AI 返回了空响应' }, { status: 500 });
    }

    const parsed = extractJson(content);
    const results: ReviewResult[] = Array.isArray(parsed)
      ? (parsed as ReviewResult[])
      : ((parsed as { results?: ReviewResult[] }).results ?? []);

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Review] Error:', error);
    return NextResponse.json(
      { error: '审核请求失败', details: message },
      { status: 500 }
    );
  }
}
