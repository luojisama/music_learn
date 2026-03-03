import { LyricLine } from '@/store/usePlayerStore';

// 支持单位或双位分钟，以及点或冒号作为毫秒分隔符
const TIME_REGEX = /\[(\d{1,2}):(\d{2})[.:](\d{2,3})\]/g;

/**
 * 将 LRC 行中的所有时间戳提取出来，返回秒数数组
 */
function extractTimestamps(line: string): number[] {
  const times: number[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(TIME_REGEX.source, 'g');
  while ((match = re.exec(line)) !== null) {
    const min = parseInt(match[1]);
    const sec = parseInt(match[2]);
    const ms = parseInt(match[3]);
    const msVal = match[3].length === 3 ? ms / 1000 : ms / 100;
    times.push(min * 60 + sec + msVal);
  }
  return times;
}

/**
 * 去除 LRC 行中所有时间戳，返回纯文本
 */
function stripTimestamps(line: string): string {
  return line.replace(/\[\d{1,2}:\d{2}[.:]\d{2,3}\]/g, '').trim();
}

/**
 * 检查是否是纯符号/元数据行，应当被过滤掉
 */
function isMeaningless(text: string): boolean {
  // 过滤纯音符、分隔符、空白行
  return /^[♪♫\-_\s]*$/.test(text);
}

/**
 * 解析 LRC 格式歌词
 * - 支持多时间戳行：[00:00.00][01:00.00]歌词
 * - 支持单位数分钟：[0:00.00]
 * - 支持冒号代替点：[00:00:00]
 * - 翻译匹配容忍 ±0.3s
 */
export function parseLrc(lrc: string, tlyric?: string): LyricLine[] {
  if (!lrc || !lrc.trim()) return [];

  const lines: LyricLine[] = [];

  // 构建翻译时间→文本映射，容忍 ±0.3s（精度到 0.1s = ×10，±3格）
  const tlyricMap = new Map<number, string>();
  if (tlyric) {
    tlyric.split('\n').forEach(line => {
      const times = extractTimestamps(line);
      if (times.length === 0) return;
      const text = stripTimestamps(line);
      if (!text || isMeaningless(text)) return;
      const key = Math.round(times[0] * 10);
      // 以最近的时间为准，允许范围 ±3 个 0.1s 格
      for (let offset = -3; offset <= 3; offset++) {
        const k = key + offset;
        if (!tlyricMap.has(k)) {
          tlyricMap.set(k, text);
        }
      }
    });
  }

  lrc.split('\n').forEach(line => {
    const timestamps = extractTimestamps(line);
    if (timestamps.length === 0) return;

    const text = stripTimestamps(line);
    if (!text || isMeaningless(text)) return;

    // 支持多时间戳行，每个时间戳都创建一条歌词
    for (const time of timestamps) {
      const key = Math.round(time * 10);
      // 查找容忍范围内的翻译
      let translation = '';
      for (let offset = 0; offset <= 3; offset++) {
        if (tlyricMap.has(key + offset)) { translation = tlyricMap.get(key + offset)!; break; }
        if (offset > 0 && tlyricMap.has(key - offset)) { translation = tlyricMap.get(key - offset)!; break; }
      }
      lines.push({ time, text, translation });
    }
  });

  return lines.sort((a, b) => a.time - b.time);
}

/**
 * 解析纯文本歌词（无时间戳），将每行均分到整首歌时长
 * 如果不知道时长，每行默认 3 秒
 */
export function parsePlainLyric(text: string, durationSec = 0): LyricLine[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !isMeaningless(l));
  if (lines.length === 0) return [];

  const interval = durationSec > 0 ? durationSec / lines.length : 3;
  return lines.map((text, i) => ({ time: i * interval, text, translation: '' }));
}

/**
 * 解析网易云提供的 romalrc（罗马音 LRC），返回 时间(×10取整) → 罗马音 的映射
 * 可直接用于给对应 LyricLine 填充 romaji 字段
 */
export function parseRomalrc(romalrc: string): Map<number, string> {
  const map = new Map<number, string>();
  if (!romalrc || !romalrc.trim()) return map;

  romalrc.split('\n').forEach(line => {
    const times = extractTimestamps(line);
    if (times.length === 0) return;
    const text = stripTimestamps(line);
    if (!text || isMeaningless(text)) return;
    // 以第一个时间戳为准，存入映射（±2 格容忍）
    const key = Math.round(times[0] * 10);
    for (let offset = -2; offset <= 2; offset++) {
      if (!map.has(key + offset)) {
        map.set(key + offset, text);
      }
    }
  });

  return map;
}
