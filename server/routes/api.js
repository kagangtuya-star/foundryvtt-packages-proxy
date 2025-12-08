import { Router } from 'express';
import config from '../config.js';
import cacheManager from '../utils/cache.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/health
 * 健康检查端点
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

/**
 * GET /api/proxies
 * 获取当前可用的代理列表
 */
router.get('/proxies', (req, res) => {
    const { github, gitlab, timeout } = config.proxies;
    const serverProxy = config.server.publicUrl;

    res.json({
        github: [...github, serverProxy + '/proxy/github/'],  // 添加后端作为兜底
        gitlab: [...gitlab, serverProxy + '/proxy/gitlab/'],
        timeout,
        serverProxy  // 返回后端代理地址
    });
});

/**
 * GET /api/cache/stats
 * 获取缓存统计信息
 */
router.get('/cache/stats', (req, res) => {
    const stats = cacheManager.getStats();
    res.json({
        ...stats,
        keys: cacheManager.keys().length,
        ttl: config.cache.ttl
    });
});

/**
 * POST /api/cache/flush
 * 清空缓存 (管理接口)
 */
router.post('/cache/flush', (req, res) => {
    cacheManager.flush();
    logger.info('Cache flushed via API');
    res.json({ status: 'ok', message: 'Cache flushed' });
});

export default router;
