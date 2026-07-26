#!/usr/bin/env node

const base = (process.env.STREAMVAULT_BASE_URL || 'http://127.0.0.1:3002').replace(/\/$/, '');
const token = process.env.STREAMVAULT_AUTH_TOKEN || '';
const auth = token ? { Authorization: `Bearer ${token}` } : {};
const results = [];

async function check(name, method, route, expected, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 30_000);
  try {
    const headers = { ...auth, ...(options.headers || {}) };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}${route}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const allowed = Array.isArray(expected) ? expected : [expected];
    const ok = allowed.includes(response.status);
    let data;
    if (options.json) data = await response.json();
    else if (options.cancelBody) await response.body?.cancel();
    else await response.arrayBuffer();
    results.push({ name, method, route: route.split('?')[0], status: response.status, ok });
    return { ok, data };
  } catch (error) {
    results.push({ name, method, route: route.split('?')[0], status: 'ERR', ok: false, error: error instanceof Error ? error.message : String(error) });
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

const checks = [
  ['health', 'GET', '/api/health', 200],
  ['categories', 'GET', '/api/categories?type=livetv', 200],
  ['channels paginated', 'GET', '/api/channels?limit=1', 200],
  ['channels by IDs', 'POST', '/api/channels/by-ids', 200, { body: { ids: [] } }],
  ['browse', 'GET', '/api/browse?type=livetv&limit=1', 200],
  ['search', 'GET', '/api/search?q=__streamvault_smoke__&type=livetv', 200],
  ['fetch-all validation', 'POST', '/api/fetch-all', 400, { body: {} }],
  ['programs', 'GET', '/api/programs?from=0&to=1', 200],
  ['EPG batch', 'GET', '/api/epg/batch', 200],
  ['EPG channel', 'GET', '/api/epg/channel/__missing__?from=0&to=1', 200],
  ['EPG validation', 'GET', '/api/epg/not-a-number', 400],
  ['series validation', 'GET', '/api/series/not-a-number', 400],
  ['VOD validation', 'GET', '/api/vod/not-a-number', 400],
  ['client logs', 'POST', '/api/client-logs', 200, { body: { logs: [] } }],
  ['player page', 'GET', '/api/player/__missing__', 200],
  ['stream missing channel', 'GET', '/api/stream/__missing__', 404],
  ['proxy validation', 'GET', '/api/proxy', 400],
  ['recordings', 'GET', '/api/recordings?limit=1&offset=0', 200],
  ['recording validation', 'POST', '/api/recordings', 400, { body: {} }],
  ['record from program validation', 'POST', '/api/recordings/from-program', 400, { body: {} }],
  ['recording lookup missing', 'GET', '/api/recordings/__missing__', 404],
  ['recording delete missing', 'DELETE', '/api/recordings/__missing__', 404],
  ['recording cancel missing', 'POST', '/api/recordings/__missing__/cancel', 404, { body: {} }],
  ['recording stop missing', 'POST', '/api/recordings/__missing__/stop', 404, { body: {} }],
  ['recording stream missing', 'GET', '/api/recordings/__missing__/stream', 404],
  ['recording status', 'GET', '/api/recording-status', 200],
  ['recording rules', 'GET', '/api/recording-rules', 200],
  ['recording rule validation', 'POST', '/api/recording-rules', 400, { body: {} }],
  ['recording rule update missing', 'PUT', '/api/recording-rules/__missing__', 404, { body: {} }],
  ['recording rule delete missing', 'DELETE', '/api/recording-rules/__missing__', 200],
  ['config read', 'GET', '/api/config', 200],
  ['config validation', 'PUT', '/api/config', 400, { body: { inputMode: '__invalid__' } }],
  ['sync status', 'GET', '/api/status', 200],
  ['sync start', 'POST', '/api/sync', 200, { body: {} }],
  ['sync cancel', 'POST', '/api/sync/cancel', 200, { body: {} }],
  ['crawl start', 'POST', '/api/crawl', 200, { body: {} }],
  ['crawl cancel', 'POST', '/api/crawl/cancel', 200, { body: {} }],
];
for (const args of checks) await check(...args);

const samples = {};
for (const type of ['livetv', 'movies', 'series']) {
  const sample = await check(`${type} sample`, 'GET', `/api/browse?type=${type}&limit=1`, 200, { json: true });
  samples[type] = sample.data?.channels?.[0];
}
if (samples.livetv?.id) {
  await check('EPG upstream', 'GET', `/api/epg/${encodeURIComponent(String(samples.livetv.id).replace(/^live_/, ''))}`, 200, { timeout: 60_000 });
  await check('player production channel', 'GET', `/api/player/${encodeURIComponent(samples.livetv.id)}`, 200);
}
if (samples.movies?.id) {
  await check('VOD upstream', 'GET', `/api/vod/${encodeURIComponent(String(samples.movies.id).replace(/^(?:movie|vod)_/, ''))}`, 200, { timeout: 60_000 });
  await check('VOD stream', 'GET', `/api/stream/${encodeURIComponent(samples.movies.id)}`, [200, 206], {
    headers: { Range: 'bytes=0-1023' }, cancelBody: true, timeout: 60_000,
  });
}
if (samples.series?.id) {
  await check('series upstream', 'GET', `/api/series/${encodeURIComponent(String(samples.series.id).replace(/^series_/, ''))}`, 200, { timeout: 60_000 });
}
if (samples.movies?.url) {
  await check('generic proxy upstream', 'GET', `/api/proxy?url=${encodeURIComponent(samples.movies.url)}`, [200, 206], {
    headers: { Range: 'bytes=0-1023' }, cancelBody: true, timeout: 60_000,
  });
}

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${String(result.status).padStart(3)} ${result.method.padEnd(6)} ${result.route} — ${result.name}${result.error ? ` (${result.error})` : ''}`);
}
const failed = results.filter(result => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
