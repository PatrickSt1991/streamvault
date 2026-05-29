import { describe, expect, it } from 'vitest';
import { isAuthorizedRequest, maskConfigResponse, normalizeAllowedOrigins, validateExternalHttpUrl } from './security';

describe('server security helpers', () => {
  it('masks secrets in config responses while preserving presence flags', () => {
    expect(maskConfigResponse({
      inputMode: 'xtream',
      playlistUrl: '',
      epgUrl: '',
      xtreamServer: 'https://provider.example',
      xtreamUsername: 'alice',
      xtreamPassword: 'secret',
      syncInterval: '24h',
    })).toEqual({
      inputMode: 'xtream',
      playlistUrl: '',
      epgUrl: '',
      xtreamServer: 'https://provider.example',
      xtreamUsername: 'alice',
      xtreamPassword: '',
      hasXtreamPassword: true,
      syncInterval: '24h',
    });
  });

  it('accepts requests when no auth token is configured', () => {
    expect(isAuthorizedRequest(undefined, undefined)).toBe(true);
  });

  it('requires bearer token or x-streamvault-token when configured', () => {
    expect(isAuthorizedRequest('Bearer expected', 'expected')).toBe(true);
    expect(isAuthorizedRequest('wrong', 'expected', 'expected')).toBe(true);
    expect(isAuthorizedRequest('Bearer wrong', 'expected')).toBe(false);
    expect(isAuthorizedRequest(undefined, 'expected')).toBe(false);
  });

  it('normalizes configured CORS origins', () => {
    expect(normalizeAllowedOrigins('https://a.example, http://b.example ')).toEqual(['https://a.example', 'http://b.example']);
    expect(normalizeAllowedOrigins('')).toEqual([]);
  });

  it('rejects non-http, localhost, private, and link-local URLs', () => {
    expect(validateExternalHttpUrl('file:///etc/passwd').ok).toBe(false);
    expect(validateExternalHttpUrl('http://localhost:3000').ok).toBe(false);
    expect(validateExternalHttpUrl('http://127.0.0.1:3000').ok).toBe(false);
    expect(validateExternalHttpUrl('http://10.0.0.5/video.ts').ok).toBe(false);
    expect(validateExternalHttpUrl('http://192.168.1.5/video.ts').ok).toBe(false);
    expect(validateExternalHttpUrl('http://169.254.1.5/video.ts').ok).toBe(false);
  });

  it('allows external http urls and can restrict them to an allowlist', () => {
    expect(validateExternalHttpUrl('https://cdn.example.com/video.ts').ok).toBe(true);
    expect(validateExternalHttpUrl('https://cdn.example.com/video.ts', ['cdn.example.com']).ok).toBe(true);
    expect(validateExternalHttpUrl('https://evil.example/video.ts', ['cdn.example.com']).ok).toBe(false);
  });
});
