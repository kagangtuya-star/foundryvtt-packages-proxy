import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 默认配置
const defaultConfig = {
    server: {
        port: 3000,
        host: '0.0.0.0',
        publicUrl: 'http://localhost:3000'
    },
    https: {
        enabled: false,
        cert: './certs/cert.pem',
        key: './certs/key.pem'
    },
    proxies: {
        github: [
            'https://gh-proxy.com/',
            'https://ghproxy.net/',
            'https://mirror.ghproxy.com/',
            'https://ghps.cc/'
        ],
        gitlab: [
            'https://gitlab.com/'
        ],
        timeout: 10000,
        healthCheckInterval: 60000
    },
    cache: {
        enabled: true,
        ttl: 1800,
        maxEntries: 100
    },
    logging: {
        level: 'info',
        logRequests: true
    },
    cors: {
        enabled: true,
        origins: ['*']
    }
};

/**
 * 深度合并对象
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

/**
 * 加载配置文件
 */
function loadConfig() {
    const configPath = path.join(ROOT_DIR, 'config.yaml');
    let userConfig = {};

    // 尝试加载用户配置
    if (fs.existsSync(configPath)) {
        try {
            const configContent = fs.readFileSync(configPath, 'utf-8');
            userConfig = yaml.load(configContent) || {};
            console.log('[Config] Loaded config.yaml');
        } catch (error) {
            console.error('[Config] Error loading config.yaml:', error.message);
        }
    } else {
        console.log('[Config] No config.yaml found, using defaults');
    }

    // 合并配置
    const config = deepMerge(defaultConfig, userConfig);

    // 环境变量覆盖
    if (process.env.PORT) {
        config.server.port = parseInt(process.env.PORT, 10);
    }
    if (process.env.HOST) {
        config.server.host = process.env.HOST;
    }
    if (process.env.PUBLIC_URL) {
        config.server.publicUrl = process.env.PUBLIC_URL;
    }
    if (process.env.LOG_LEVEL) {
        config.logging.level = process.env.LOG_LEVEL;
    }

    return config;
}

// 导出配置单例
const config = loadConfig();

export default config;
export { loadConfig, ROOT_DIR };
