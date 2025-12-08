# FVTT Proxy Server
# Multi-stage build for smaller image size

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# ================================
# Production image
# ================================
FROM node:20-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY server ./server
COPY package.json ./

# Copy config example (user should provide their own config.yaml via volume)
COPY config.example.yaml ./config.example.yaml

# Create config directory
RUN mkdir -p /app/config && chown -R nodejs:nodejs /app

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start server
CMD ["node", "server/index.js"]
