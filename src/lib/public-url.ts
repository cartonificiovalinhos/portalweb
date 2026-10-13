export function getPublicBaseUrl(request: Request): string {
  const requestUrl = new URL(request.url);

  const forwardedProto = String(
    request.headers.get('x-forwarded-proto')
    || request.headers.get('x-forwarded-protocol')
    || '',
  )
    .split(',')[0]
    .trim();

  const forwardedHost = String(
    request.headers.get('x-forwarded-host')
    || request.headers.get('x-original-host')
    || request.headers.get('host')
    || '',
  )
    .split(',')[0]
    .trim();

  if (forwardedHost) {
    return `${forwardedProto || requestUrl.protocol.replace(':', '') || 'https'}://${forwardedHost}`;
  }

  if (requestUrl.hostname === '0.0.0.0' || requestUrl.hostname === '::' || requestUrl.hostname === '[::]') {
    const envUrl = String(
      process.env.PORTAL_PUBLIC_URL
      || process.env.APP_URL
      || process.env.NEXTAUTH_URL
      || '',
    ).trim();
    if (envUrl) return envUrl.replace(/\/+$/, '');
  }

  return requestUrl.origin;
}

export function buildPublicUrl(request: Request, path: string): string {
  const baseUrl = getPublicBaseUrl(request).replace(/\/+$/, '');
  const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
  return `${baseUrl}${normalizedPath}`;
}
