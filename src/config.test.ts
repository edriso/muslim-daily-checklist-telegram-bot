import { describe, it, expect } from 'vitest';
import { channelUrlFrom } from './config';

/**
 * channelUrlFrom is the only logic in config.ts: turn CHANNEL_CHAT_ID
 * into a public t.me link when one exists, and null otherwise (numeric
 * -100 ids have no derivable public link). /start relies on this.
 */
describe('channelUrlFrom', () => {
  it('builds a t.me link from an @-username', () => {
    expect(channelUrlFrom('@mychannel')).toBe('https://t.me/mychannel');
    expect(channelUrlFrom('@test_channel')).toBe('https://t.me/test_channel');
  });

  it('trims surrounding whitespace before deriving', () => {
    expect(channelUrlFrom('  @spaced  ')).toBe('https://t.me/spaced');
  });

  it('returns null for numeric ids (no public link without an API call)', () => {
    expect(channelUrlFrom('-1001234567890')).toBeNull();
    expect(channelUrlFrom('1234567890')).toBeNull();
  });

  it('normalises an explicit t.me URL to https', () => {
    expect(channelUrlFrom('https://t.me/foo')).toBe('https://t.me/foo');
    expect(channelUrlFrom('http://t.me/foo')).toBe('https://t.me/foo');
    expect(channelUrlFrom('t.me/foo')).toBe('https://t.me/foo');
  });

  it('returns null for a malformed handle rather than a broken link', () => {
    expect(channelUrlFrom('@ab')).toBeNull(); // too short
    expect(channelUrlFrom('@bad name')).toBeNull(); // space
    expect(channelUrlFrom('')).toBeNull();
  });
});
