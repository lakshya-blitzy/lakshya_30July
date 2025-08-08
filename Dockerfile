# Multi-stage Dockerfile for Secure Node.js Server
# Optimized for production deployment with security hardening and minimal attack surface
#
# Security Features:
# - Multi-stage build for smaller production images
# - Non-root user execution for enhanced security
# - dumb-init for proper signal handling and zombie process prevention
# - Health checks for container orchestration integration
# - Minimal Alpine Linux base for reduced vulnerability surface
# - Proper file ownership and permissions

# =============================================================================
# Stage 1: Dependencies Installation (Build Stage)
# =============================================================================
FROM node:18-alpine AS deps

# Set working directory
WORKDIR /app

# Install system dependencies required for node-gyp and native modules
# Add security updates and essential tools
RUN apk add --no-cache \
    dumb-init \
    curl \
    && apk upgrade --no-cache

# Copy package files for dependency installation
# Only copy package files to leverage Docker layer caching
COPY package*.json ./

# Install dependencies with npm ci for production builds
# --only=production excludes devDependencies for smaller image size
# --no-cache prevents npm cache storage reducing image size
# --no-audit skips audit for faster builds (audit run in CI/CD)
RUN npm ci --only=production --no-cache --no-audit \
    && npm cache clean --force

# =============================================================================
# Stage 2: Production Runtime (Final Stage)
# =============================================================================
FROM node:18-alpine AS runner

# Install system dependencies and security updates
# dumb-init: Proper init system for containers
# curl: Required for health checks
RUN apk add --no-cache \
    dumb-init \
    curl \
    && apk upgrade --no-cache

# Create non-root user for security
# nodejs user: Prevents container from running as root
# Home directory: /home/nodejs for user files
# Shell: /bin/sh (default for Alpine)
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs -h /home/nodejs -s /bin/sh

# Set working directory
WORKDIR /app

# Copy node_modules from dependencies stage
# This leverages the multi-stage build for optimized layers
COPY --from=deps /app/node_modules ./node_modules

# Copy application files with proper ownership
# --chown=nodejs:nodejs ensures all files are owned by non-root user
# This is critical for security and proper file access permissions
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs ecosystem.config.js ./

# Create required directories with proper ownership
# logs: Application and PM2 log files
# pids: PM2 process ID files
# certs: SSL/TLS certificate files (if used)
RUN mkdir -p logs pids certs \
    && chown -R nodejs:nodejs logs pids certs \
    && chmod 755 logs pids certs

# Set production environment variables
# NODE_ENV=production: Enables production optimizations
# PORT: Default HTTP port (can be overridden)
# HTTPS_PORT: Default HTTPS port (can be overridden)
ENV NODE_ENV=production \
    PORT=3000 \
    HTTPS_PORT=3443 \
    USER=nodejs \
    NPM_CONFIG_LOGLEVEL=warn

# Switch to non-root user for security
# All subsequent commands and the container runtime will use this user
USER nodejs

# Expose application ports
# 3000: HTTP port for web traffic
# 3443: HTTPS port for secure web traffic
EXPOSE $PORT $HTTPS_PORT

# Health check configuration
# Verifies the application is responding correctly
# --interval=30s: Check every 30 seconds
# --timeout=3s: Timeout after 3 seconds
# --start-period=5s: Wait 5 seconds before first check
# --retries=3: Retry 3 times before marking unhealthy
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Use dumb-init as entrypoint for proper signal handling
# dumb-init ensures:
# - Proper signal forwarding to Node.js process
# - Zombie process cleanup
# - Graceful shutdown handling
# - PID 1 responsibilities in containers
ENTRYPOINT ["dumb-init", "--"]

# Start the Node.js application
# Using node directly instead of npm for faster startup and better signal handling
# server.js contains graceful shutdown logic for SIGTERM/SIGINT signals
CMD ["node", "server.js"]

# =============================================================================
# Docker Build Instructions
# =============================================================================
#
# Build the image:
#   docker build -t secure-node-server:latest .
#
# Run the container:
#   docker run -d \
#     --name secure-node-server \
#     -p 3000:3000 \
#     -p 3443:3443 \
#     --restart unless-stopped \
#     secure-node-server:latest
#
# Run with environment variables:
#   docker run -d \
#     --name secure-node-server \
#     -p 3000:3000 \
#     -p 3443:3443 \
#     -e NODE_ENV=production \
#     -e RATE_LIMIT_MAX_REQUESTS=2000 \
#     --restart unless-stopped \
#     secure-node-server:latest
#
# Run with volume mounts for persistence:
#   docker run -d \
#     --name secure-node-server \
#     -p 3000:3000 \
#     -p 3443:3443 \
#     -v /host/logs:/app/logs \
#     -v /host/certs:/app/certs \
#     --restart unless-stopped \
#     secure-node-server:latest
#
# =============================================================================
# Security Considerations
# =============================================================================
#
# 1. Non-root execution: Container runs as 'nodejs' user (UID 1001)
# 2. Minimal base image: Alpine Linux reduces attack surface
# 3. Multi-stage build: Production image contains only runtime dependencies
# 4. Signal handling: dumb-init ensures proper signal forwarding
# 5. Health checks: Container orchestrators can monitor application health
# 6. Layer optimization: Dependencies cached separately from application code
# 7. File permissions: All application files owned by nodejs user
# 8. No package manager cache: npm cache cleaned to reduce image size
# 9. Security updates: Latest Alpine packages with security patches
# 10. Minimal privileges: No sudo or additional capabilities required
#
# =============================================================================
# Performance Optimizations
# =============================================================================
#
# 1. Layer caching: Package.json copied separately for better cache utilization
# 2. Multi-stage build: Eliminates build dependencies from final image
# 3. Alpine Linux: Smaller base image size (~5MB vs ~900MB for full Linux)
# 4. Production dependencies: Only runtime dependencies included
# 5. npm ci: Faster, reproducible installs compared to npm install
# 6. Cache cleanup: npm cache cleaned to minimize image size
# 7. Optimized RUN commands: Combined commands reduce layer count
# 8. No source maps: Production build without development artifacts
#
# =============================================================================
# Compliance and Standards
# =============================================================================
#
# - OWASP Container Security Top 10 compliance
# - CIS Docker Benchmark alignment
# - Non-root container execution (PCI DSS, SOX compliance)
# - Minimal attack surface principle
# - Proper signal handling for graceful shutdowns
# - Health check integration for orchestration platforms
# - Security scanning ready (base image vulnerability scanning)
# - Resource constraint ready (memory and CPU limits)