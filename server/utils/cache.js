import NodeCache from 'node-cache';
import config from '../config.js';

// 创建缓存实例
const cache = new NodeCache({
    stdTTL: config.cache.ttl,
    maxKeys: config.cache.maxEntries,
    checkperiod: 120,
    useClones: true
});

/**
 * 缓存工具类
 */
class CacheManager {
    /**
     * 获取缓存
     * @param {string} key 缓存键
     * @returns {any} 缓存值，如果不存在返回 undefined
     */
    get(key) {
        return cache.get(key);
    }

    /**
     * 设置缓存
     * @param {string} key 缓存键
     * @param {any} value 缓存值
     * @param {number} [ttl] 可选的自定义TTL (秒)
     */
    set(key, value, ttl) {
        if (ttl !== undefined) {
            cache.set(key, value, ttl);
        } else {
            cache.set(key, value);
        }
    }

    /**
     * 删除缓存
     * @param {string} key 缓存键
     */
    del(key) {
        cache.del(key);
    }

    /**
     * 清空所有缓存
     */
    flush() {
        cache.flushAll();
    }

    /**
     * 获取缓存统计信息
     */
    getStats() {
        return cache.getStats();
    }

    /**
     * 获取所有缓存键
     */
    keys() {
        return cache.keys();
    }

    /**
     * 检查缓存是否存在
     * @param {string} key 缓存键
     */
    has(key) {
        return cache.has(key);
    }
}

const cacheManager = new CacheManager();

export default cacheManager;
export { CacheManager };
