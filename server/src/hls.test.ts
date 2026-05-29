import { describe, expect, it } from 'vitest';
import { rewriteHlsManifest } from './hls';

describe('rewriteHlsManifest', () => {
  it('rewrites relative and absolute segment lines through the proxy', () => {
    const manifest = ['#EXTM3U', '#EXTINF:10,', 'seg-1.ts', '#EXTINF:10,', 'https://cdn.example.com/seg-2.ts'].join('\n');
    const rewritten = rewriteHlsManifest(manifest, 'https://origin.example/live/playlist.m3u8');
    expect(rewritten).toContain('/api/proxy?url=https%3A%2F%2Forigin.example%2Flive%2Fseg-1.ts');
    expect(rewritten).toContain('/api/proxy?url=https%3A%2F%2Fcdn.example.com%2Fseg-2.ts');
  });

  it('rewrites URI attributes for encryption keys and init maps', () => {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="keys/key.bin"',
      '#EXT-X-MAP:URI="init.mp4"',
      'chunk.ts',
    ].join('\n');
    const rewritten = rewriteHlsManifest(manifest, 'https://origin.example/live/master.m3u8');
    expect(rewritten).toContain('URI="/api/proxy?url=https%3A%2F%2Forigin.example%2Flive%2Fkeys%2Fkey.bin"');
    expect(rewritten).toContain('URI="/api/proxy?url=https%3A%2F%2Forigin.example%2Flive%2Finit.mp4"');
  });
});
