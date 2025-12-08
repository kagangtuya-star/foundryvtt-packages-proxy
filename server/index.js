import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';

import config from './config.js';
import logger from './utils/logger.js';
import apiRoutes from './routes/api.js';
import fvttRoutes from './routes/fvtt.js';
import proxyRoutes from './routes/proxy.js';

const app = express();

// ============== 中间件 ==============

// CORS 配置
if (config.cors.enabled) {
    app.use(cors({
        origin: config.cors.origins.includes('*') ? '*' : config.cors.origins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    }));
}

// JSON 解析
app.use(express.json());

// 请求日志
if (config.logging.logRequests) {
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
        });
        next();
    });
}

// ============== 路由 ==============

// API 路由
app.use('/api', apiRoutes);

// FVTT API 代理路由
app.use('/api/fvtt', fvttRoutes);

// 代理路由
app.use('/proxy', proxyRoutes);

// 根路径
app.get('/', (req, res) => {
    res.json({
        name: 'FVTT Proxy Server',
        version: '1.0.0',
        description: 'FoundryVTT GitHub/GitLab 下载加速代理服务器',
        endpoints: {
            health: '/api/health',
            proxies: '/api/proxies',
            fvttPackages: '/api/fvtt/packages',
            githubProxy: '/proxy/github/{url}',
            gitlabProxy: '/proxy/gitlab/{url}'
        }
    });
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});

// 错误处理
app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`);
    logger.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// ============== 启动服务器 ==============

function startServer() {
    const { port, host, publicUrl } = config.server;

    let server;

    // HTTPS 支持
    if (config.https.enabled) {
        try {
            const httpsOptions = {
                cert: fs.readFileSync(config.https.cert),
                key: fs.readFileSync(config.https.key)
            };
            server = https.createServer(httpsOptions, app);
            logger.info('HTTPS enabled');
        } catch (error) {
            logger.error(`Failed to load HTTPS certificates: ${error.message}`);
            logger.info('Falling back to HTTP');
            server = http.createServer(app);
        }
    } else {
        server = http.createServer(app);
    }

    server.listen(port, host, () => {
        logger.info('========================================');
        logger.info('  FVTT Proxy Server Started');
        logger.info('========================================');
        logger.info(`  Local:   http://${host}:${port}`);
        logger.info(`  Public:  ${publicUrl}`);
        logger.info(`  Env:     ${process.env.NODE_ENV || 'development'}`);
        logger.info('========================================');
        logger.info('Endpoints:');
        logger.info(`  Health:        ${publicUrl}/api/health`);
        logger.info(`  Proxy List:    ${publicUrl}/api/proxies`);
        logger.info(`  FVTT Packages: ${publicUrl}/api/fvtt/packages`);
        logger.info(`  GitHub Proxy:  ${publicUrl}/proxy/github/{url}`);
        logger.info(`  GitLab Proxy:  ${publicUrl}/proxy/gitlab/{url}`);
        logger.info('========================================');
    });

    // 优雅关闭
    process.on('SIGTERM', () => {
        logger.info('SIGTERM received, shutting down...');
        server.close(() => {
            logger.info('Server closed');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        logger.info('SIGINT received, shutting down...');
        server.close(() => {
            logger.info('Server closed');
            process.exit(0);
        });
    });
}

startServer();
