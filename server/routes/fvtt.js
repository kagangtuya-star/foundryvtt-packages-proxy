import { Router } from 'express';
import config from '../config.js';
import cacheManager from '../utils/cache.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/fvtt/packages
 * 代理 FoundryVTT 包获取 API
 * 原始 API: https://foundryvtt.com/_api/packages/get
 */
router.post('/packages', async (req, res) => {
    const FVTT_API_URL = 'https://foundryvtt.com/_api/packages/get';

    // 生成缓存键 (基于请求体)
    const cacheKey = `fvtt_packages_${JSON.stringify(req.body)}`;

    // 检查缓存
    if (config.cache.enabled) {
        const cached = cacheManager.get(cacheKey);
        if (cached) {
            logger.debug(`Cache hit for FVTT packages: ${cacheKey.substring(0, 50)}...`);
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }
    }

    logger.info(`Proxying FVTT packages API request`);
    res.set('X-Cache', 'MISS');

    try {
        // 转发请求到 FVTT API
        const response = await fetch(FVTT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 转发原始请求头 (不包括 host 等)
                ...(req.headers.authorization ? { 'Authorization': req.headers.authorization } : {})
            },
            body: JSON.stringify(req.body),
            signal: AbortSignal.timeout(config.proxies.timeout)
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`FVTT API error: ${response.status} - ${errorText}`);
            return res.status(response.status).json({
                error: 'FVTT API request failed',
                status: response.status,
                message: errorText
            });
        }

        const data = await response.json();

        // 缓存响应
        if (config.cache.enabled) {
            cacheManager.set(cacheKey, data);
            logger.debug(`Cached FVTT packages response: ${cacheKey.substring(0, 50)}...`);
        }

        res.json(data);
    } catch (error) {
        logger.error(`Failed to proxy FVTT API: ${error.message}`);
        res.status(502).json({
            error: 'Failed to proxy FVTT API',
            message: error.message
        });
    }
});

/**
 * POST /api/fvtt/auth
 * 代理 FoundryVTT 认证 API (用于受保护包的下载)
 * 原始 API: https://foundryvtt.com/_api/packages/auth
 */
router.post('/auth', async (req, res) => {
    const FVTT_AUTH_URL = 'https://foundryvtt.com/_api/packages/auth';

    logger.info(`Proxying FVTT auth API request`);

    try {
        const response = await fetch(FVTT_AUTH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(req.headers.authorization ? { 'Authorization': req.headers.authorization } : {})
            },
            body: JSON.stringify(req.body),
            signal: AbortSignal.timeout(config.proxies.timeout)
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`FVTT Auth API error: ${response.status} - ${errorText}`);
            return res.status(response.status).json({
                error: 'FVTT Auth API request failed',
                status: response.status,
                message: errorText
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        logger.error(`Failed to proxy FVTT Auth API: ${error.message}`);
        res.status(502).json({
            error: 'Failed to proxy FVTT Auth API',
            message: error.message
        });
    }
});

export default router;
