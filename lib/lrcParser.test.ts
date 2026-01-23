import { describe, it, expect } from 'vitest';
import { parseLrc } from './lrcParser';

describe('lrcParser', () => {
  it('should parse basic lrc correctly', () => {
    const lrc = `[00:01.00]Hello\n[00:02.50]World`;
    const result = parseLrc(lrc);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ time: 1, text: 'Hello', translation: '' });
    expect(result[1]).toEqual({ time: 2.5, text: 'World', translation: '' });
  });

  it('should handle translation matching', () => {
    const lrc = `[00:01.00]Hello`;
    const tlyric = `[00:01.00]你好`;
    const result = parseLrc(lrc, tlyric);
    expect(result[0].translation).toBe('你好');
  });

  it('should sort by time', () => {
    const lrc = `[00:02.00]Second\n[00:01.00]First`;
    const result = parseLrc(lrc);
    expect(result[0].text).toBe('First');
    expect(result[1].text).toBe('Second');
  });
});
