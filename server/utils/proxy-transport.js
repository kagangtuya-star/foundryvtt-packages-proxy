import http from 'node:http';
import https from 'node:https';
import { pipeline } from 'node:stream';

const httpAgent = new http.Agent({keepAlive: true, maxSockets: 100});
const httpsAgent = new https.Agent({keepAlive: true, maxSockets: 100});
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const RETRY_STATUSES = new Set([401, 403, 404, 405, 408, 425, 429]);
const HOP_HEADERS = new Set(['transfer-encoding', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'upgrade']);

function parseHttpUrl(value) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported');
    return url;
}

/** Build prefix-style mirror URLs, then a separate direct fallback. */
export function buildProxyCandidates(targetUrl, proxies = [], serverBase = '') {
    const target = parseHttpUrl(targetUrl);
    let serverOrigin;
    try { serverOrigin = parseHttpUrl(serverBase).origin; } catch { /* No public URL configured. */ }
    const candidates = [];
    for (const prefix of proxies) {
        if (typeof prefix !== 'string' || !prefix.trim()) continue;
        try {
            const base = parseHttpUrl(prefix.trim());
            // A bare upstream origin means direct access, not a prefix proxy.
            // Never send the request back into this backend's own proxy route.
            if (base.origin === serverOrigin ||
                (base.origin === target.origin && base.pathname === '/' && !base.search)) continue;
            if (base.search || base.hash || base.username || base.password) continue;
            const candidate = base.href.replace(/\/+$/, '') + '/' + targetUrl;
            if (!candidates.includes(candidate)) candidates.push(candidate);
        } catch { /* Ignore invalid configuration entries; direct access remains available. */ }
    }
    if (!candidates.includes(targetUrl)) candidates.push(targetUrl);
    return candidates;
}

function requestOnce(url, req, {controller, timeout, originalOrigin, body}) {
    return new Promise((resolve, reject) => {
        const headers = {
            Host: url.host,
            'User-Agent': req.headers['user-agent'] || 'FVTT-Proxy-Server/1.0',
            Accept: req.headers.accept || '*/*',
            'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9'
        };
        for (const name of ['range', 'if-range', 'if-none-match', 'if-modified-since', 'content-type']) {
            if (req.headers[name]) headers[name] = req.headers[name];
        }
        // Do not disclose upstream credentials to mirror hosts or unrelated redirects.
        if (url.origin === originalOrigin && req.headers.authorization) headers.Authorization = req.headers.authorization;
        if (body !== undefined) headers['Content-Length'] = Buffer.byteLength(body);
        else if (req.headers['content-length']) headers['Content-Length'] = req.headers['content-length'];

        const transport = url.protocol === 'https:' ? https : http;
        const upstreamReq = transport.request(url, {
            method: req.method, headers, signal: controller.signal,
            agent: url.protocol === 'https:' ? httpsAgent : httpAgent
        }, response => resolve({response, url: url.href}));
        upstreamReq.on('error', reject);
        // Also bound inactivity while a large response is streaming.
        upstreamReq.setTimeout(timeout, () => upstreamReq.destroy(new Error('Upstream request timed out')));
        if (body !== undefined) upstreamReq.end(body);
        else if (['POST', 'PUT', 'PATCH'].includes(req.method)) req.pipe(upstreamReq);
        else upstreamReq.end();
    });
}

async function followRedirects(candidate, req, context) {
    let url = parseHttpUrl(candidate);
    const proxyOrigin = url.origin;
    for (let count = 0; count <= 10; count++) {
        const result = await requestOnce(url, req, context);
        const {response} = result;
        if (!REDIRECTS.has(response.statusCode) || !response.headers.location) return result;
        response.on('error', () => {});
        response.destroy();
        if (count === 10) throw new Error('Too many redirects');
        const next = parseHttpUrl(new URL(response.headers.location, url).href);
        if (next.origin !== proxyOrigin && !context.isAllowedTarget(next.href)) {
            throw new Error('Blocked redirect target');
        }
        // Streaming request bodies cannot be replayed safely on a redirect.
        if (!['GET', 'HEAD'].includes(req.method)) throw new Error('Cannot replay a non-read request on redirect');
        url = next;
    }
}

function hasInvalidContentType(response, originalUrl) {
    const path = new URL(originalUrl).pathname;
    const type = String(response.headers['content-type'] || '').split(';')[0].toLowerCase();
    return /\.zip$/i.test(path) && ['text/html', 'application/json'].includes(type) ||
        /\.json$/i.test(path) && type === 'text/html';
}

/** Retry only read requests and only before sending response headers downstream. */
export async function proxyWithFailover(targetUrl, req, res, {
    proxies = [], serverBase = '', timeout = 10000, isAllowedTarget = () => false,
    logger = {info() {}, warn() {}, error() {}}
} = {}) {
    let candidates;
    try {
        candidates = ['GET', 'HEAD'].includes(req.method)
            ? buildProxyCandidates(targetUrl, proxies, serverBase)
            : [parseHttpUrl(targetUrl).href];
    } catch (error) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Invalid URL', message: error.message}));
        return;
    }
    timeout = Math.max(1, Number(timeout) || 10000);
    const originalOrigin = new URL(targetUrl).origin;
    // express.json() has already consumed JSON bodies in the main app.
    const body = req.readableEnded && req.body !== undefined && ['POST', 'PUT', 'PATCH'].includes(req.method)
        ? JSON.stringify(req.body) : undefined;
    let clientClosed = res.destroyed;
    let activeController;
    const onClose = () => { clientClosed = true; activeController?.abort(); };
    res.once('close', onClose);
    const cleanup = () => res.off('close', onClose);
    let lastError;
    for (const [index, candidate] of candidates.entries()) {
        if (clientClosed) break;
        const controller = new AbortController();
        activeController = controller;
        // Bound the entire connection + redirect chain, including DNS/TLS waits.
        const deadline = setTimeout(() => controller.abort(new Error('Upstream request timed out')), timeout);
        try {
            logger.info(`Proxy attempt ${index + 1}/${candidates.length}: ${req.method} ${candidate}`);
            const {response, url} = await followRedirects(candidate, req, {
                controller, timeout, originalOrigin, body, isAllowedTarget
            });
            clearTimeout(deadline);
            if (clientClosed) { response.destroy(); break; }
            const invalidContent = response.statusCode >= 200 && response.statusCode < 300 &&
                hasInvalidContentType(response, targetUrl);
            const retryStatus = RETRY_STATUSES.has(response.statusCode) || response.statusCode >= 500;
            if (invalidContent || retryStatus && index < candidates.length - 1) {
                response.on('error', () => {});
                response.destroy();
                controller.abort();
                lastError = new Error(invalidContent ? 'Upstream returned an error page instead of a package' : `Upstream returned HTTP ${response.statusCode}`);
                logger.warn(lastError.message);
                continue;
            }
            const headers = {};
            const connectionHeaders = String(response.headers.connection || '').toLowerCase().split(',').map(value => value.trim());
            for (const [key, value] of Object.entries(response.headers)) {
                if (!HOP_HEADERS.has(key.toLowerCase()) && !connectionHeaders.includes(key.toLowerCase())) headers[key] = value;
            }
            headers['X-Proxied-By'] = 'FVTT-Proxy-Server';
            headers['X-Original-URL'] = url;
            res.writeHead(response.statusCode, headers);
            pipeline(response, res, error => {
                cleanup();
                if (error && !clientClosed) logger.error(`Upstream response error: ${error.message}`);
            });
            return;
        } catch (error) {
            lastError = error;
            controller.abort();
            if (!clientClosed) logger.warn(`Proxy attempt failed: ${error.message}`);
        } finally {
            clearTimeout(deadline);
        }
    }
    cleanup();
    if (!clientClosed && !res.headersSent) {
        res.writeHead(502, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'All proxy attempts failed', message: lastError?.message, url: targetUrl}));
    }
}
