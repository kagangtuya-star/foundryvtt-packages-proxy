/** Client transport entry point. Mirror selection and retries live in the backend. */
export const FVTT_PROXY_BASE = (process.env.FVTT_PACKAGE_PROXY_URL ?? "https://fvtt-download-cdn.aivu.top").replace(/\/+$/, "");
export const FVTT_API_PROXY = FVTT_PROXY_BASE ? FVTT_PROXY_BASE + "/api/fvtt/packages" : "";

const GITHUB_DOMAINS = ["github.com", "raw.githubusercontent.com", "gist.github.com", "gist.githubusercontent.com", "codeload.github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com", "api.github.com"];
const GITLAB_DOMAINS = ["gitlab.com"];

export function checkUrlNeedsProxy(url) {
    try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) return {needsProxy: false, type: null};
        const matches = domains => domains.some(domain => parsed.hostname === domain || parsed.hostname.endsWith("." + domain));
        if (matches(GITHUB_DOMAINS)) return {needsProxy: true, type: "github"};
        if (matches(GITLAB_DOMAINS)) return {needsProxy: true, type: "gitlab"};
    } catch { /* Leave relative or invalid URLs alone. */ }
    return {needsProxy: false, type: null};
}

export function getProxiedUrl(originalUrl) {
    const {needsProxy, type} = checkUrlNeedsProxy(originalUrl);
    return needsProxy && FVTT_PROXY_BASE ? FVTT_PROXY_BASE + "/proxy/" + type + "/" + originalUrl : originalUrl;
}
