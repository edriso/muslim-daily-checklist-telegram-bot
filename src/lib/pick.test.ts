import { describe, it, expect } from 'vitest';
import { pickContent } from './pick';

describe('pickContent', () => {
  it('returns the string as-is when input is a non-empty string', () => {
    expect(pickContent('hello')).toBe('hello');
  });

  it('returns null for an empty string (whitespace-only counts as empty)', () => {
    expect(pickContent('')).toBe(null);
    expect(pickContent('   ')).toBe(null);
  });

  it('returns null for an empty array', () => {
    expect(pickContent([])).toBe(null);
  });

  it('returns the single element when the array has one item', () => {
    expect(pickContent(['only'])).toBe('only');
  });

  it('returns an element that exists in the array', () => {
    const arr = ['a', 'b', 'c'];
    const result = pickContent(arr);
    expect(arr).toContain(result);
  });

  it('eventually picks each element from a multi-item array (probabilistic sanity check)', () => {
    const arr = ['a', 'b', 'c'];
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const picked = pickContent(arr);
      if (picked) seen.add(picked);
    }
    expect(seen.size).toBe(3);
  });

  it('accepts readonly arrays', () => {
    const arr = ['a', 'b'] as const;
    expect(['a', 'b']).toContain(pickContent(arr));
  });
});
