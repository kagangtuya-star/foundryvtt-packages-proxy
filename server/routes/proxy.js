import { Router } from 'express';
import config from '../config.js';
import { proxyWithFailover } from '../utils/proxy-transport.js';
import { URL } from 'node:url';
import logger from '../utils/logger.js';

const router = Router();

// GitHub 相关域名匹配模式
const GITHUB_DOMAINS = [
    'github.com',
    'raw.githubusercontent.com',
    'gist.github.com',
    'gist.githubusercontent.com',
    'codeload.github.com',
    'objects.githubusercontent.com',
    'release-assets.githubusercontent.com',
    'githubusercontent.com',
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

function isAllowedTarget(url) {
    return matchesDomains(url, [...GITHUB_DOMAINS, ...GITLAB_DOMAINS]);
}

/** GitHub/GitLab mirrors are tried in configuration order, then direct access. */
function proxyRequest(targetUrl, req, res) {
    const kind = matchesDomains(targetUrl, GITHUB_DOMAINS) ? 'github'
        : matchesDomains(targetUrl, GITLAB_DOMAINS) ? 'gitlab' : null;
    return proxyWithFailover(targetUrl, req, res, {
        proxies: kind ? config.proxies[kind] : [],
        serverBase: config.server.publicUrl,
        timeout: config.proxies.timeout,
        isAllowedTarget,
        logger
    });
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

