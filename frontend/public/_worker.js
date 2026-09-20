// Copyright (C) 2026 Johandi Arifiansyach

// Cloudflare Pages only serves the frontend and proxies API requests to the
// Oracle gateway. The old backend Worker is archived and is not used here.
const PRODUCTION_API_ORIGIN = 'https://api.eposyandu.app';
const STAGING_API_ORIGIN = 'https://api-staging.eposyandu.app';
const MAINTENANCE_GATEWAY_STATUSES = new Set([500, 502, 503, 504]);

function safeConfiguredOrigin(value, fallback) {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    const cleanPath = url.pathname === '' || url.pathname === '/';
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !cleanPath) {
      return fallback;
    }
    return url.origin;
  } catch {
    return fallback;
  }
}

function upstreamOrigin(hostname, env) {
  if (hostname.includes('e-posyandu-staging.pages.dev')) {
    return safeConfiguredOrigin(env.STAGING_API_ORIGIN, STAGING_API_ORIGIN);
  }
  return safeConfiguredOrigin(env.PRODUCTION_API_ORIGIN, PRODUCTION_API_ORIGIN);
}

function isApiPath(pathname) {
  return pathname === '/api/health' || pathname.startsWith('/api/v1/');
}

function isDocumentRequest(request, pathname) {
  if (request.method.toUpperCase() !== 'GET') return false;
  if (pathname === '/maintenance.html') return false;
  const accept = request.headers.get('Accept') || '';
  return pathname === '/'
    || pathname.endsWith('.html')
    || accept.includes('text/html')
    || request.headers.get('Sec-Fetch-Mode') === 'navigate';
}

function envFlag(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function maintenanceCacheSeconds(env) {
  const value = Number.parseInt(String(env.MAINTENANCE_HEALTH_CACHE_SECONDS || '15'), 10);
  return Number.isFinite(value) ? Math.min(120, Math.max(5, value)) : 15;
}

function healthCacheKey(request) {
  const url = new URL('/__e_posyandu_origin_health__', request.url);
  return new Request(url.toString(), { method: 'GET' });
}

async function readHealthCache(request) {
  if (typeof caches === 'undefined' || !caches.default) return null;
  try {
    const cached = await caches.default.match(healthCacheKey(request));
    if (!cached) return null;
    const payload = await cached.json();
    return typeof payload.healthy === 'boolean' ? payload.healthy : null;
  } catch {
    return null;
  }
}

async function writeHealthCache(request, healthy, seconds) {
  if (typeof caches === 'undefined' || !caches.default) return;
  try {
    const response = new Response(JSON.stringify({ healthy }), {
      headers: {
        'Cache-Control': `public, max-age=${seconds}`,
        'Content-Type': 'application/json'
      }
    });
    await caches.default.put(healthCacheKey(request), response);
  } catch {
    // The maintenance decision must not depend on the optional edge cache.
  }
}

async function probeOriginHealth(origin) {
  try {
    const target = new URL('/api/health', origin);
    const response = await fetch(new Request(target.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-E-Posyandu-Health-Probe': 'pages'
      }
    }));
    // A response such as 401/404 still proves that the origin is reachable;
    // only gateway/upstream failures should activate the maintenance page.
    return !MAINTENANCE_GATEWAY_STATUSES.has(response.status);
  } catch {
    return false;
  }
}

async function shouldServeMaintenance(request, env, incomingUrl) {
  if (!isDocumentRequest(request, incomingUrl.pathname)) return false;
  if (envFlag(env.MAINTENANCE_MODE)) return true;
  if (!envFlag(env.AUTO_MAINTENANCE_ON_HEALTH_FAILURE, true)) return false;

  const cached = await readHealthCache(request);
  if (cached !== null) return !cached;

  const primary = upstreamOrigin(incomingUrl.hostname, env);
  const healthy = await probeOriginHealth(primary);
  await writeHealthCache(request, healthy, maintenanceCacheSeconds(env));
  return !healthy;
}

async function serveMaintenancePage(request, env) {
  const maintenanceUrl = new URL('/maintenance.html', request.url);
  let assetResponse;
  try {
    assetResponse = await env.ASSETS.fetch(new Request(maintenanceUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'text/html' }
    }));
  } catch {
    return new Response('<!doctype html><title>E-Posyandu sedang dipelihara</title><h1>E-Posyandu sedang dipelihara</h1><p>Silakan coba kembali beberapa saat lagi.</p>', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'text/html; charset=UTF-8',
        'Retry-After': '120',
        'X-E-Posyandu-Maintenance': 'active'
      }
    });
  }
  const headers = new Headers(assetResponse.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('Retry-After', '120');
  headers.set('X-E-Posyandu-Maintenance', 'active');
  return new Response(assetResponse.body, {
    status: 503,
    statusText: 'Service Unavailable',
    headers
  });
}

function createUpstreamRequest(request, origin, pathname, search) {
  const target = new URL(`${pathname}${search}`, origin);
  const headers = new Headers(request.headers);
  headers.delete('Host');
  headers.set('X-E-Posyandu-Proxy', 'pages');
  return new Request(target, {
    method: request.method,
    headers,
    body: request.method.toUpperCase() === 'GET' || request.method.toUpperCase() === 'HEAD' || request.method.toUpperCase() === 'OPTIONS'
      ? undefined
      : request.body,
    redirect: 'manual'
  });
}

export default {
  async fetch(request, env) {
    const incomingUrl = new URL(request.url);
    if (!isApiPath(incomingUrl.pathname)) {
      if (await shouldServeMaintenance(request, env, incomingUrl)) {
        return serveMaintenancePage(request, env);
      }
      return env.ASSETS.fetch(request);
    }

    const primaryOrigin = upstreamOrigin(incomingUrl.hostname, env);
    return fetch(
      createUpstreamRequest(request, primaryOrigin, incomingUrl.pathname, incomingUrl.search)
    );
  }
};
