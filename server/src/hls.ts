function proxied(url: string): string {
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

function resolveManifestUrl(value: string, baseUrl: string): string {
  return new URL(value, baseUrl).toString();
}

export function rewriteHlsManifest(body: string, playlistUrl: string): string {
  return body.split(/\r?\n/).map(line => {
    if (!line) return line;

    if (line.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
        return `URI="${proxied(resolveManifestUrl(uri, playlistUrl))}"`;
      });
    }

    return proxied(resolveManifestUrl(line.trim(), playlistUrl));
  }).join('\n');
}
