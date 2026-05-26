import { Agent, setGlobalDispatcher } from 'undici';
import { logger } from './logger.js';

/**
 * Shared HTTP dispatcher for all upstream stream fetches.
 *
 * Why: each upstream request previously opened a new TCP+TLS connection,
 * which is brutal for VOD seeks (every Range request = full handshake).
 * Keepalive + connection pool reuses sockets, drops cold-start by ~200-500ms.
 *
 *  - connections: per-origin pool size. 32 covers Range parallel + multiple users.
 *  - pipelining: 1 — disabled. Pipelining + HTTP/1.1 + stream bodies = head-of-line blocking.
 *  - keepAliveTimeout: how long an idle socket stays open client-side.
 *  - bodyTimeout: 0 — VOD/live streams are long, never time out the body.
 *  - headersTimeout: still bound so a dead upstream fails fast.
 */
export const streamAgent = new Agent({
  connections: 32,
  pipelining: 1,
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 600_000,
  headersTimeout: 30_000,
  bodyTimeout: 0,
  connect: {
    keepAlive: true,
    keepAliveInitialDelay: 1_000,
  },
});

// Use this dispatcher for any plain `fetch()` call too, so even ad-hoc fetches
// reuse the pool (Xtream sync, EPG fetches, etc.).
setGlobalDispatcher(streamAgent);

logger.info('HTTP keepalive agent installed (connections=32, keepAliveTimeout=30s)');

/**
 * Fire-and-forget DNS + TLS prewarm for an upstream host so the first user
 * play hits a warm socket. Called from sync.ts on startup once Xtream config
 * is known.
 */
export async function prewarmUpstream(serverUrl: string): Promise<void> {
  try {
    const u = new URL(serverUrl);
    const probeUrl = `${u.protocol}//${u.host}/`;
    const ctl = AbortSignal.timeout(5_000);
    await fetch(probeUrl, { method: 'HEAD', signal: ctl, dispatcher: streamAgent } as RequestInit & { dispatcher: Agent });
    logger.info(`Upstream prewarm OK: ${u.host}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Upstream prewarm skipped: ${msg}`);
  }
}
