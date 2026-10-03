/**
 * FVTT 代理辅助模块
 * 用于客户端的代理 URL 处理和多代理自动切换
 */

// ============== 配置 ==============

// 默认代理服务器地址 (应该替换为实际部署的服务器地址)
const DEFAULT_PROXY_SERVER = "https://fvtt-download-cdn.aivu.top";

// 默认代理列表 - 使用统一代理端点 /proxy/
const DEFAULT_PROXIES = {
    github: [
        "https://gh-proxy.com/",
        "https://ghproxy.net/",
        "https://mirror.ghproxy.com/",
        "https://ghps.cc/",
        // 后端服务器统一代理作为最终兜底
        `${DEFAULT_PROXY_SERVER}/proxy/`
    ],
    gitlab: [
        // 后端服务器统一代理作为兜底
        `${DEFAULT_PROXY_SERVER}/proxy/`
    ],
    timeout: 10000
};

// GitHub 相关域名
const GITHUB_DOMAINS = [
    'github.com',
    'raw.githubusercontent.com',
    'gist.github.com',
    'gist.githubusercontent.com',
    'codeload.github.com',
    'objects.githubusercontent.com',
    'release-assets.githubusercontent.com',
    'api.github.com'
];

// GitLab 相关域名
const GITLAB_DOMAINS = [
    'gitlab.com'
];

// ============== 状态管理 ==============

let cachedProxies = null;
let proxiesCacheTime = 0;
const PROXIES_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

let proxyServer = DEFAULT_PROXY_SERVER;

// ============== 公共 API ==============

/**
 * 设置代理服务器地址
 */
export function setProxyServer(serverUrl) {
    proxyServer = serverUrl.replace(/\/$/, '');
    cachedProxies = null;
}

/**
 * 获取代理服务器地址
 */
export function getProxyServer() {
    return proxyServer;
}

/**
 * 检查 URL 是否需要代理
 */
export function checkUrlNeedsProxy(url) {
    if (!url) return { needsProxy: false, type: null };

    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        if (!['http:', 'https:'].includes(urlObj.protocol)) return {needsProxy: false, type: null};

        if (GITHUB_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
            return { needsProxy: true, type: 'github' };
        }

        if (GITLAB_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
            return { needsProxy: true, type: 'gitlab' };
        }
    } catch (e) {
        // 无效 URL
    }

    return { needsProxy: false, type: null };
}

/**
 * 从代理服务器获取代理列表
 */
export async function fetchProxyList() {
    if (cachedProxies && (Date.now() - proxiesCacheTime) < PROXIES_CACHE_TTL) {
        return cachedProxies;
    }

    try {
        const response = await fetch(`${proxyServer}/api/proxies`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            cachedProxies = await response.json();
            proxiesCacheTime = Date.now();
            global.logger?.info?.('[Proxy Helper] Fetched proxy list from server');
            return cachedProxies;
        }
    } catch (error) {
        global.logger?.warn?.(`[Proxy Helper] Failed to fetch proxy list: ${error.message}`);
    }

    return {
        ...DEFAULT_PROXIES,
        github: [...DEFAULT_PROXIES.github.filter(url => !url.includes('/proxy/')), `${proxyServer}/proxy/github/`],
        gitlab: [`${proxyServer}/proxy/gitlab/`]
    };
}

/**
 * 快速获取代理 URL（不进行连通性测试）
 */
export async function getProxyUrl(originalUrl) {
    const {needsProxy, type} = checkUrlNeedsProxy(originalUrl);
    return needsProxy && proxyServer ? `${proxyServer}/proxy/${type}/${originalUrl}` : originalUrl;
}

/**
 * 尝试使用代理列表获取工作的代理 URL
 */
export async function getWorkingProxyUrl(originalUrl, options = {}) {
    const { timeout = 8000, useHeadRequest = true } = options;
    let proxies = options.proxies;

    if (!proxies) {
        const proxyList = await fetchProxyList();
        const { type } = checkUrlNeedsProxy(originalUrl);
        proxies = proxyList[type] || [];
    }

    // 添加后端统一代理作为兜底
    const serverFallbackProxy = `${proxyServer}/proxy/`;
    if (!proxies.includes(serverFallbackProxy)) {
        proxies = [...proxies, serverFallbackProxy];
    }

    global.logger?.debug?.(`[Proxy Helper] Testing ${proxies.length} proxies for: ${originalUrl}`);

    for (const proxy of proxies) {
        const proxyUrl = proxy + originalUrl;

        try {
            if (useHeadRequest) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(proxyUrl, {
                    method: 'HEAD',
                    signal: controller.signal,
                    redirect: 'follow'
                });

                clearTimeout(timeoutId);

                if (response.ok || response.status === 302 || response.status === 301) {
                    global.logger?.info?.(`[Proxy Helper] Found working proxy: ${proxy}`);
                    return proxyUrl;
                }
            } else {
                global.logger?.info?.(`[Proxy Helper] Using proxy: ${proxy}`);
                return proxyUrl;
            }
        } catch (error) {
            global.logger?.debug?.(`[Proxy Helper] Proxy failed: ${proxy} - ${error.message}`);
            continue;
        }
    }

    global.logger?.warn?.(`[Proxy Helper] All proxies failed, using original URL: ${originalUrl}`);
    return originalUrl;
}

/**
 * 创建带代理支持的 fetch 函数
 */
export function createProxiedFetch() {
    return async function proxiedFetch(url, fetchOptions = {}) {
        const { needsProxy } = checkUrlNeedsProxy(url);

        if (needsProxy) {
            const proxyUrl = await getProxyUrl(url);
            global.logger?.debug?.(`[Proxy Helper] Redirecting fetch: ${url} -> ${proxyUrl}`);
            return fetch(proxyUrl, fetchOptions);
        }

        return fetch(url, fetchOptions);
    };
}

// ============== 默认导出 ==============

export default {
    setProxyServer,
    getProxyServer,
    checkUrlNeedsProxy,
    fetchProxyList,
    getWorkingProxyUrl,
    getProxyUrl,
    createProxiedFetch,
    DEFAULT_PROXIES,
    GITHUB_DOMAINS,
    GITLAB_DOMAINS
};
