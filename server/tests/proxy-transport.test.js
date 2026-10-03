import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {buildProxyCandidates, proxyWithFailover} from '../utils/proxy-transport.js';

async function serve(t, handler) {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    });
    return `http://127.0.0.1:${server.address().port}`;
}

async function backend(t, target, proxies, options = {}) {
    return serve(t, (req, res) => {
        void proxyWithFailover(target, req, res, {
            proxies, timeout: 1000,
            isAllowedTarget: url => new URL(url).origin === new URL(target).origin,
            ...options
        });
    });
}

test('candidate order, trailing slashes, direct fallback and recursion avoidance', () => {
    const target = 'https://gitlab.com/a/repo.zip';
    assert.deepEqual(buildProxyCandidates(target, [
        'https://mirror.example', 'https://mirror.example/', 'https://gitlab.com/',
        'https://backend.example/proxy/gitlab/', 'ftp://bad.example/', 'not a url'
    ], 'https://backend.example'), ['https://mirror.example/' + target, target]);
    assert.throws(() => buildProxyCandidates('ftp://github.com/file.zip'), /HTTP/);
});

test('HTTP failure switches to the next mirror and streams the successful response', async t => {
    const hits = [];
    const direct = await serve(t, (req, res) => { hits.push('direct'); res.end('direct'); });
    const first = await serve(t, (req, res) => { hits.push('first'); res.writeHead(503); res.end('failure'); });
    const second = await serve(t, (req, res) => {
        hits.push('second');
        assert.equal(req.url, '/' + direct + '/repo.zip?token=abc');
        res.writeHead(200, {'Content-Type': 'application/zip', 'X-Mirror': 'second'});
        res.end('zip contents');
    });
    const url = await backend(t, direct + '/repo.zip?token=abc', [first, second]);
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-mirror'), 'second');
    assert.equal(await response.text(), 'zip contents');
    assert.deepEqual(hits, ['first', 'second']);
});

test('connection reset and timeout fall through to direct access', async t => {
    const hits = [];
    const first = await serve(t, req => { hits.push('reset'); req.socket.destroy(); });
    const second = await serve(t, () => { hits.push('timeout'); });
    const direct = await serve(t, (req, res) => { hits.push('direct'); res.end('ok'); });
    const url = await backend(t, direct + '/manifest.json', [first, second], {timeout: 100});
    assert.equal(await (await fetch(url)).text(), 'ok');
    assert.deepEqual(hits, ['reset', 'timeout', 'direct']);
});

test('HEAD and range requests retain their method and range headers', async t => {
    const requests = [];
    const direct = await serve(t, (req, res) => { res.writeHead(500); res.end(); });
    const mirror = await serve(t, (req, res) => {
        requests.push({method: req.method, range: req.headers.range});
        res.writeHead(206, {'Content-Range': 'bytes 0-2/6', 'Content-Length': '3', 'Content-Type': 'application/zip'});
        res.end('zip');
    });
    const url = await backend(t, direct + '/repo.zip', [mirror]);
    const head = await fetch(url, {method: 'HEAD'});
    assert.equal(head.status, 206);
    assert.equal(await head.text(), '');
    const partial = await fetch(url, {headers: {Range: 'bytes=0-2'}});
    assert.equal(partial.headers.get('content-range'), 'bytes 0-2/6');
    assert.equal(await partial.text(), 'zip');
    assert.deepEqual(requests, [{method: 'HEAD', range: undefined}, {method: 'GET', range: 'bytes=0-2'}]);
});

test('same-mirror and allowed upstream redirects are followed', async t => {
    const direct = await serve(t, (req, res) => { res.end('asset'); });
    const mirror = await serve(t, (req, res) => {
        res.writeHead(302, {Location: req.url === '/step' ? direct + '/asset.zip' : '/step'});
        res.end();
    });
    const url = await backend(t, direct + '/repo.zip', [mirror]);
    const response = await fetch(url);
    assert.equal(await response.text(), 'asset');
    assert.equal(response.headers.get('x-original-url'), direct + '/asset.zip');
});

test('blocked redirects are not contacted; the next mirror is tried', async t => {
    let contacted = false;
    const blocked = await serve(t, (req, res) => { contacted = true; res.end('bad'); });
    const first = await serve(t, (req, res) => { res.writeHead(302, {Location: blocked}); res.end(); });
    const direct = await serve(t, (req, res) => { res.end('ok'); });
    const url = await backend(t, direct + '/repo.zip', [first]);
    assert.equal(await (await fetch(url)).text(), 'ok');
    assert.equal(contacted, false);
});

test('redirect loops have a finite retry budget', async t => {
    let redirects = 0;
    const first = await serve(t, (req, res) => { redirects++; res.writeHead(302, {Location: '/loop'}); res.end(); });
    const direct = await serve(t, (req, res) => { res.end('ok'); });
    const url = await backend(t, direct + '/repo.zip', [first]);
    assert.equal(await (await fetch(url)).text(), 'ok');
    assert.equal(redirects, 11);
});

test('200 HTML error pages are rejected before accepting a ZIP response', async t => {
    const first = await serve(t, (req, res) => { res.writeHead(200, {'Content-Type': 'text/html'}); res.end('<h1>blocked</h1>'); });
    const direct = await serve(t, (req, res) => { res.writeHead(200, {'Content-Type': 'application/zip'}); res.end('good'); });
    const url = await backend(t, direct + '/repo.zip', [first]);
    assert.equal(await (await fetch(url)).text(), 'good');
});

test('terminal upstream status is preserved after all mirrors fail', async t => {
    const first = await serve(t, (req, res) => { res.writeHead(403); res.end('mirror blocked'); });
    const direct = await serve(t, (req, res) => { res.writeHead(404); res.end('missing'); });
    const url = await backend(t, direct + '/repo.zip', [first]);
    const response = await fetch(url);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'missing');
});

test('all network attempts failing returns a finite 502 response', async t => {
    const direct = await serve(t, req => req.socket.destroy());
    const url = await backend(t, direct + '/repo.zip', []);
    const response = await fetch(url);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, 'All proxy attempts failed');
});

test('POST is sent once directly and parsed JSON is forwarded with its actual length', async t => {
    let mirrorHit = false;
    let directHits = 0;
    const mirror = await serve(t, (req, res) => { mirrorHit = true; res.end(); });
    const direct = await serve(t, async (req, res) => {
        directHits++;
        let body = '';
        for await (const chunk of req) body += chunk;
        assert.equal(body, '{"hello":"world"}');
        assert.equal(Number(req.headers['content-length']), Buffer.byteLength(body));
        res.writeHead(503); res.end('no replay');
    });
    const url = await serve(t, async (req, res) => {
        for await (const chunk of req) { /* Mimic express.json consuming the stream. */ }
        req.body = {hello: 'world'};
        void proxyWithFailover(direct + '/api', req, res, {proxies: [mirror], timeout: 1000});
    });
    const response = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{ "hello": "world" }'});
    assert.equal(response.status, 503);
    assert.equal(await response.text(), 'no replay');
    assert.equal(directHits, 1);
    assert.equal(mirrorHit, false);
});

test('authorization is withheld from mirrors and retained for direct fallback', async t => {
    const auth = [];
    const mirror = await serve(t, (req, res) => { auth.push(req.headers.authorization); res.writeHead(401); res.end(); });
    const direct = await serve(t, (req, res) => { auth.push(req.headers.authorization); res.end('ok'); });
    const url = await backend(t, direct + '/repo.zip', [mirror]);
    await (await fetch(url, {headers: {Authorization: 'Bearer test'}})).text();
    assert.deepEqual(auth, [undefined, 'Bearer test']);
});

test('unparsed request bodies are streamed unchanged', async t => {
    const direct = await serve(t, async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk;
        res.end(body);
    });
    const url = await serve(t, (req, res) => {
        req.body = {}; // express.json leaves an empty body object for non-JSON requests.
        void proxyWithFailover(direct + '/api', req, res, {timeout: 1000});
    });
    const response = await fetch(url, {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: 'original body'});
    assert.equal(await response.text(), 'original body');
});

test('a truncated streaming response is aborted without appending another mirror', async t => {
    let directHit = false;
    const direct = await serve(t, (req, res) => { directHit = true; res.end('other'); });
    const mirror = await serve(t, (req, res) => {
        res.writeHead(200, {'Content-Length': '100', 'Content-Type': 'application/zip'});
        res.write('partial');
        setTimeout(() => res.destroy(), 30);
    });
    const url = await backend(t, direct + '/repo.zip', [mirror]);
    const response = await fetch(url);
    await assert.rejects(response.text());
    assert.equal(directHit, false);
});

test('a stalled response body is aborted by the inactivity timeout', async t => {
    let directHit = false;
    const direct = await serve(t, (req, res) => { directHit = true; res.end('other'); });
    const mirror = await serve(t, (req, res) => {
        res.writeHead(200, {'Content-Type': 'application/zip'});
        res.write('partial');
    });
    const url = await backend(t, direct + '/repo.zip', [mirror], {timeout: 100});
    const response = await fetch(url);
    await assert.rejects(response.text());
    assert.equal(directHit, false);
});

test('client cancellation stops the active upstream and prevents retries', async t => {
    let directHit = false;
    let started;
    let disconnected;
    const upstreamStarted = new Promise(resolve => { started = resolve; });
    const upstreamDisconnected = new Promise(resolve => { disconnected = resolve; });
    const direct = await serve(t, (req, res) => { directHit = true; res.end('other'); });
    const mirror = await serve(t, (req, res) => {
        req.socket.once('close', disconnected);
        started();
    });
    const url = await backend(t, direct + '/repo.zip', [mirror]);
    const controller = new AbortController();
    const response = fetch(url, {signal: controller.signal});
    const rejection = assert.rejects(response, {name: 'AbortError'});
    await upstreamStarted;
    controller.abort();
    await rejection;
    await upstreamDisconnected;
    assert.equal(directHit, false);
});
