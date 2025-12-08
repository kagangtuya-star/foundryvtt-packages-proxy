import { Router } from 'express';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import logger from '../utils/logger.js';

const router = Router();

// HTTP/HTTPS agents with keep-alive for better performance
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });

// GitHub 相关域名匹配模式
const GITHUB_DOMAINS = [
    'github.com',
    'raw.githubusercontent.com',
    'gist.github.com',
    'gist.githubusercontent.com',
    'codeload.github.com',
    'objects.githubusercontent.com',
    'api.github.com'
];

// GitLab 相关域名匹配模式
const GITLAB_DOMAINS = [
    'gitlab.com'
];

/**
 * 检查 URL 是否匹配指定域名
 */
function matchesDomains(url, domains) {
    try {
        const urlObj = new URL(url);
        return domains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain));
    } catch {
        return false;
    }
}

/**
 * 发起代理请求 (支持重定向)
 * @param {string} targetUrl 目标URL
 * @param {object} req Express请求对象
 * @param {object} res Express响应对象
 * @param {number} redirectCount 重定向计数
 */
function proxyRequest(targetUrl, req, res, redirectCount = 0) {
    // 防止无限重定向
    if (redirectCount > 10) {
        logger.error(`Too many redirects for: ${targetUrl}`);
        return res.status(502).json({ error: 'Too many redirects' });
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        logger.error(`Invalid URL: ${targetUrl}`);
        return res.status(400).json({ error: 'Invalid URL', url: targetUrl });
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    logger.info(`Proxying: ${req.method} ${targetUrl}${redirectCount > 0 ? ` (redirect ${redirectCount})` : ''}`);

    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: req.method,
        agent: isHttps ? httpsAgent : httpAgent,
        headers: {
            'Host': parsedUrl.host,
            'User-Agent': req.headers['user-agent'] || 'FVTT-Proxy-Server/1.0',
            'Accept': req.headers['accept'] || '*/*',
            'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
        }
    };

    // 对于特定请求类型，添加额外 headers
    if (req.headers['authorization']) {
        options.headers['Authorization'] = req.headers['authorization'];
    }
    if (req.headers['content-type']) {
        options.headers['Content-Type'] = req.headers['content-type'];
    }
    if (req.headers['content-length']) {
        options.headers['Content-Length'] = req.headers['content-length'];
    }

    const proxyReq = httpModule.request(options, (proxyRes) => {
        const statusCode = proxyRes.statusCode;

        // 处理重定向
        if ([301, 302, 303, 307, 308].includes(statusCode) && proxyRes.headers.location) {
            const location = proxyRes.headers.location;
            // 解析重定向 URL (可能是相对路径)
            const redirectUrl = new URL(location, targetUrl).href;
            logger.info(`Following redirect: ${statusCode} -> ${redirectUrl}`);

            // 消费当前响应体
            proxyRes.resume();

            // 递归跟随重定向
            return proxyRequest(redirectUrl, req, res, redirectCount + 1);
        }

        // 设置响应头
        const headers = {};
        for (const [key, value] of Object.entries(proxyRes.headers)) {
            // 跳过某些 headers
            const lowerKey = key.toLowerCase();
            if (!['transfer-encoding', 'connection', 'keep-alive'].includes(lowerKey)) {
                headers[key] = value;
            }
        }

        // 添加代理标识
        headers['X-Proxied-By'] = 'FVTT-Proxy-Server';
        headers['X-Original-URL'] = targetUrl;

        // 发送响应头
        res.writeHead(statusCode, headers);

        // 直接 pipe 响应数据（流式传输）
        proxyRes.pipe(res);

        // 错误处理 - 客户端断开连接时会触发 aborted，这是正常的
        proxyRes.on('error', (err) => {
            if (err.message !== 'aborted') {
                logger.error(`Upstream response error: ${err.message}`);
            }
        });
    });

    // 请求错误
    proxyReq.on('error', (err) => {
        logger.error(`Proxy request error: ${err.message}`);
        if (!res.headersSent) {
            res.status(502).json({
                error: 'Proxy request failed',
                message: err.message,
                url: targetUrl
            });
        }
    });

    // 客户端断开连接时，中止代理请求
    res.on('close', () => {
        if (!proxyReq.destroyed) {
            proxyReq.destroy();
        }
    });

    // 转发请求体（如果有）
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        req.pipe(proxyReq);
    } else {
        proxyReq.end();
    }
}

/**
 * GitHub 代理路由
 */
router.all('/github/*', (req, res) => {
    // 手动解析 URL - 获取 /proxy/github/ 之后的所有内容
    const fullUrl = req.originalUrl;
    const prefix = '/proxy/github/';
    const targetUrl = fullUrl.substring(fullUrl.indexOf(prefix) + prefix.length);

    if (!targetUrl) {
        return res.status(400).json({ error: 'Target URL is required' });
    }

    // 验证 URL
    if (!matchesDomains(targetUrl, GITHUB_DOMAINS)) {
        return res.status(400).json({
            error: 'Invalid GitHub URL',
            message: 'Only GitHub-related URLs are allowed',
            url: targetUrl,
            allowedDomains: GITHUB_DOMAINS
        });
    }

    proxyRequest(targetUrl, req, res);
});

/**
 * GitLab 代理路由
 */
router.all('/gitlab/*', (req, res) => {
    const fullUrl = req.originalUrl;
    const prefix = '/proxy/gitlab/';
    const targetUrl = fullUrl.substring(fullUrl.indexOf(prefix) + prefix.length);

    if (!targetUrl) {
        return res.status(400).json({ error: 'Target URL is required' });
    }

    if (!matchesDomains(targetUrl, GITLAB_DOMAINS)) {
        return res.status(400).json({
            error: 'Invalid GitLab URL',
            message: 'Only GitLab-related URLs are allowed',
            url: targetUrl,
            allowedDomains: GITLAB_DOMAINS
        });
    }

    proxyRequest(targetUrl, req, res);
});

/**
 * 通用 URL 代理路由
 */
router.all('/url/*', (req, res) => {
    const fullUrl = req.originalUrl;
    const prefix = '/proxy/url/';
    const targetUrl = fullUrl.substring(fullUrl.indexOf(prefix) + prefix.length);

    if (!targetUrl) {
        return res.status(400).json({ error: 'Target URL is required' });
    }

    try {
        new URL(targetUrl);
    } catch {
        return res.status(400).json({ error: 'Invalid URL format', url: targetUrl });
    }

    proxyRequest(targetUrl, req, res);
});

// 所有允许的域名（用于统一代理）
const ALL_ALLOWED_DOMAINS = [...GITHUB_DOMAINS, ...GITLAB_DOMAINS];

/**
 * 统一代理路由 - 同时支持 GitHub 和 GitLab
 * 使用方式: /proxy/https://github.com/... 或 /proxy/https://gitlab.com/...
 */
router.all('/*', (req, res) => {
    const fullUrl = req.originalUrl;

    // 跳过已有的子路由
    if (fullUrl.startsWith('/proxy/github/') ||
        fullUrl.startsWith('/proxy/gitlab/') ||
        fullUrl.startsWith('/proxy/url/')) {
        return res.status(404).json({ error: 'Use specific routes' });
    }

    // 从 /proxy/ 后面提取目标 URL
    const prefix = '/proxy/';
    const prefixIndex = fullUrl.indexOf(prefix);
    if (prefixIndex === -1) {
        return res.status(400).json({ error: 'Invalid proxy path' });
    }

    const targetUrl = fullUrl.substring(prefixIndex + prefix.length);

    if (!targetUrl || !targetUrl.startsWith('http')) {
        return res.status(200).send(`
            <h1>FVTT Proxy Server</h1>
            <p>代理服务已启动。使用方式:</p>
            <ul>
                <li><code>/proxy/https://github.com/...</code></li>
                <li><code>/proxy/https://gitlab.com/...</code></li>
                <li><code>/proxy/https://raw.githubusercontent.com/...</code></li>
            </ul>
            <p>允许的域名: ${ALL_ALLOWED_DOMAINS.join(', ')}</p>
        `);
    }

    // 验证 URL 是否在允许列表中
    if (!matchesDomains(targetUrl, ALL_ALLOWED_DOMAINS)) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Only GitHub and GitLab URLs are allowed',
            url: targetUrl,
            allowedDomains: ALL_ALLOWED_DOMAINS
        });
    }

    proxyRequest(targetUrl, req, res);
});

export default router;
