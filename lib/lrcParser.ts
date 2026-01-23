import { LyricLine } from '@/store/usePlayerStore';

export function parseLrc(lrc: string, tlyric?: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const timeExp = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  
  const lrcLines = lrc.split('\n');
  const tlyricMap = new Map<number, string>();

  // Parse translation first if available
  if (tlyric) {
    const tLines = tlyric.split('\n');
    tLines.forEach(line => {
      const match = timeExp.exec(line);
      if (match) {
        const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / (match[3].length === 3 ? 1000 : 100);
        const text = line.replace(timeExp, '').trim();
        // Use a tolerance for matching, or just exact match. Usually exact.
        // Let's store by strict time or rounded?
        // tlyric times might slightly differ.
        // For simplicity, map by time string? No, float is better.
        tlyricMap.set(Math.floor(time * 10), text); // Match to 0.1s precision
      }
    });
  }

  lrcLines.forEach(line => {
    const match = timeExp.exec(line);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3]);
      // Normalize ms to seconds (e.g. 99 -> 0.99, 999 -> 0.999)
      const msVal = match[3].length === 3 ? ms / 1000 : ms / 100;
      const time = min * 60 + sec + msVal;
      const text = line.replace(timeExp, '').trim();

      if (text) {
        // Try to find translation
        const tText = tlyricMap.get(Math.floor(time * 10));
        
        lines.push({
          time,
          text,
          translation: tText || ''
        });
      }
    }
  });

  return lines.sort((a, b) => a.time - b.time);
}
