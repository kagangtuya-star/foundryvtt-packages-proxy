# FVTT 下载加速代理

FoundryVTT 的 GitHub/GitLab 下载加速解决方案，包含后端代理服务器和客户端补丁。

## 功能特性

- ✅ **GitHub/GitLab 代理** - 加速模组和系统下载
- ✅ **多代理自动切换** - 失败时自动尝试下一个代理
- ✅ **统一代理端点** - `/proxy/{url}` 同时支持 GitHub 和 GitLab
- ✅ **FVTT API 缓存** - 30 分钟 TTL，减少 API 请求
- ✅ **Docker 部署** - 一键部署
- ✅ **HTTPS 支持** - 可配置 SSL 证书

## 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone <repo-url>
cd FVTT下载改进

# 2. 创建配置
cp config.example.yaml config.yaml
# 编辑 config.yaml 修改 publicUrl

# 3. 启动
docker-compose up -d

# 4. 查看日志
docker-compose logs -f
```

### 方式二：直接运行

```bash
npm install
cp config.example.yaml config.yaml
npm start
```

## 项目结构

```
├── server/                 # 后端服务器
│   ├── index.js           # 入口文件
│   ├── config.js          # 配置加载
│   ├── routes/
│   │   ├── api.js         # API 路由
│   │   ├── fvtt.js        # FVTT API 代理
│   │   └── proxy.js       # GitHub/GitLab 代理
│   └── utils/
│       ├── cache.js       # 缓存管理
│       └── logger.js      # 日志
├── client/                 # 客户端补丁
│   ├── package.mjs        # 替换 FVTT 的 package.mjs
│   └── views.mjs          # 替换 FVTT 的 views.mjs
├── config.example.yaml    # 配置模板
├── Dockerfile             # Docker 构建
└── docker-compose.yml     # Docker Compose
```

## 服务端 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/proxies` | GET | 获取代理列表 |
| `/proxy/{url}` | ALL | 统一代理 (GitHub + GitLab) |
| `/proxy/github/{url}` | ALL | GitHub 代理 |
| `/proxy/gitlab/{url}` | ALL | GitLab 代理 |
| `/api/fvtt/packages` | POST | FVTT 包列表 API (带缓存) |
| `/api/fvtt/auth` | POST | FVTT 认证 API |

### 使用示例

```bash
# 代理 GitHub 文件
curl https://your-server.com/proxy/https://github.com/user/repo/releases/download/v1.0/file.zip

# 代理 GitLab 文件
curl https://your-server.com/proxy/https://gitlab.com/user/repo/-/archive/main/repo-main.zip

# 健康检查
curl https://your-server.com/api/health
```

## 客户端配置

### 方式一：一键安装（推荐）

**Windows:**
```batch
# 双击运行 install.bat，按提示输入 FVTT 目录
install.bat

# 或直接指定目录
install.bat "C:\Program Files\FoundryVTT"
```

**Linux/macOS:**
```bash
# 添加执行权限
chmod +x install.sh

# 运行安装脚本
./install.sh /path/to/foundryvtt
```

**功能：**
- ✅ 自动搜索 FVTT 的 `dist/packages/` 目录
- ✅ 自动备份原文件（带时间戳）
- ✅ 从 `client.zip` 解压并安装补丁
- ✅ 安装完成后提示重启 FVTT

**卸载/恢复：**
```bash
# Windows
uninstall.bat

# Linux/macOS
./uninstall.sh
```

### 方式二：手动配置

#### 1. 修改客户端文件

解压 `client.zip`，编辑 `package.mjs` 和 `views.mjs` 顶部的配置区域：

```javascript
// ╔═══════════════════════════════════════════════════════════════╗
// ║                    手动配置区域 - 请在此处修改                  ║
// ╚═══════════════════════════════════════════════════════════════╝

const GITHUB_PROXIES = [
  "https://your-proxy.com/proxy/",
  "https://gh-proxy.com/",
  // 更多代理...
];

const GITLAB_PROXIES = [
  "https://your-proxy.com/proxy/",
];

// FVTT API 代理 (可选)
const FVTT_API_PROXY = "https://your-proxy.com/api/fvtt/packages";
```

#### 2. 复制到 FVTT

将修改后的文件复制到 FVTT 安装目录：

```bash
# Windows
copy package.mjs "C:\Program Files\FoundryVTT\resources\app\dist\packages\"
copy views.mjs "C:\Program Files\FoundryVTT\resources\app\dist\packages\"

# Linux/macOS
cp package.mjs /path/to/foundry/resources/app/dist/packages/
cp views.mjs /path/to/foundry/resources/app/dist/packages/
```

#### 3. 重启 FVTT

## 服务端配置 (config.yaml)

```yaml
server:
  port: 3000
  host: "0.0.0.0"
  publicUrl: "https://your-server.com"

proxies:
  github:
    - "https://gh-proxy.com/"
    - "https://ghproxy.net/"
  gitlab:
    - "https://gitlab.com/"
  timeout: 10000

cache:
  enabled: true
  ttl: 1800  # 30 分钟

logging:
  level: "info"

cors:
  enabled: true
  origins: ["*"]
```

## Docker 部署

### docker-compose.yml

```yaml
version: '3.8'
services:
  fvtt-proxy:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/app/config.yaml:ro
    environment:
      - HOST=0.0.0.0
    restart: unless-stopped
```

### 常用命令

```bash
docker-compose up -d        # 启动
docker-compose down         # 停止
docker-compose logs -f      # 查看日志
docker-compose restart      # 重启
docker-compose build --no-cache  # 重新构建
```

## 反向代理配置 (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name your-proxy.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 大文件传输
        proxy_buffering off;
        proxy_read_timeout 300s;
        client_max_body_size 0;
    }
}
```

## 注意事项

1. **FVTT 更新** - FVTT 更新后需重新复制客户端文件
2. **HTTPS** - 生产环境建议使用 HTTPS
3. **服务器位置** - 建议部署在能快速访问 GitHub 的地区（如香港、日本、美国）
4. **FVTT API 是 POST** - `/api/fvtt/packages` 是 POST 请求，浏览器直接访问会 404

## 许可证

MIT
