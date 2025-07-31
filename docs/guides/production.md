# Production Deployment Guide

This guide covers production deployment procedures, PM2 configuration, environment setup, monitoring, scaling strategies, and maintenance procedures for deploying the Node.js Hello World server in production environments with high availability requirements.

## Table of Contents

1. [Overview](#overview)
2. [Production Requirements](#production-requirements)
3. [PM2 Configuration](#pm2-configuration)
4. [Environment Variables](#environment-variables)
5. [Monitoring Setup](#monitoring-setup)
6. [Scaling Strategies](#scaling-strategies)
7. [Deployment Workflow](#deployment-workflow)
8. [Maintenance Procedures](#maintenance-procedures)
9. [Performance Optimization](#performance-optimization)
10. [Security Considerations](#security-considerations)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

## Overview

Production deployment of the Node.js Hello World server requires careful consideration of process management, monitoring, scaling, and maintenance to ensure high availability and optimal performance. This guide provides comprehensive instructions for deploying and managing the server using PM2 (Process Manager 2) as the primary process management solution.

### Key Benefits of Production Deployment

- **High Availability**: Zero-downtime deployments and automatic process recovery
- **Scalability**: Horizontal scaling across multiple CPU cores
- **Monitoring**: Real-time application metrics and health monitoring
- **Load Balancing**: Built-in cluster mode for optimal resource utilization
- **Performance**: Optimized memory usage and process management

## Production Requirements

### System Prerequisites

| Component | Minimum Version | Recommended Version | Notes |
|-----------|----------------|---------------------|-------|
| **Node.js** | 14.0.0 | 18.0.0+ | LTS versions recommended |
| **npm** | 6.0.0 | 8.0.0+ | Comes with Node.js installation |
| **PM2** | 5.0.0 | Latest | Global installation required |
| **Operating System** | Ubuntu 18.04+ / CentOS 7+ | Ubuntu 20.04+ / CentOS 8+ | Linux preferred for production |
| **Memory** | 1GB RAM | 4GB+ RAM | Depends on expected load |
| **Storage** | 10GB | 50GB+ | Include logs and backups |

### Performance Analysis

Based on the simple HTTP server implementation, the following performance characteristics are expected:

```javascript
// Source: Basic HTTP server implementation
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello, World!\n');
});
```

- **Memory Usage**: ~15-30MB per process
- **Response Time**: <10ms for Hello World response
- **Throughput**: 10,000-20,000 requests/second per core
- **CPU Usage**: Minimal for simple responses

### Network Requirements

| Port | Protocol | Purpose | Access |
|------|----------|---------|--------|
| 3000 | HTTP | Application server | Internal/External |
| 22 | SSH | Server management | Internal only |
| 80/443 | HTTP/HTTPS | Load balancer/Proxy | External |

## PM2 Configuration

### Installation

Install PM2 globally on your production server:

```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version

# Enable PM2 startup script
pm2 startup
```

### Basic PM2 Configuration

Create a PM2 ecosystem configuration file:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'hello-world-server',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        MAX_MEMORY_RESTART: '1G'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
```

### Advanced PM2 Configuration

For enhanced production features:

```javascript
// ecosystem.production.config.js
module.exports = {
  apps: [
    {
      name: 'hello-world-prod',
      script: './server.js',
      instances: 4, // Specific number of instances
      exec_mode: 'cluster',
      
      // Environment configuration
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'info',
        MAX_CONNECTIONS: 1000
      },
      
      // Logging configuration
      log_type: 'json',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Performance settings
      max_memory_restart: '1G',
      node_args: [
        '--max-old-space-size=1024',
        '--optimize-for-size'
      ],
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Process management
      kill_timeout: 5000,
      listen_timeout: 8000,
      max_restarts: 5,
      min_uptime: '30s',
      
      // Deployment settings
      post_update: ['npm install', 'echo "Deployment complete"'],
      
      // Monitoring
      pmx: true,
      automation: false
    }
  ],
  
  deploy: {
    production: {
      user: 'deploy',
      host: 'production-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/hello-world-server.git',
      path: '/var/www/hello-world-server',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
```

## Environment Variables

### Core Environment Variables

Create a comprehensive environment configuration:

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Application settings
APP_NAME=hello-world-server
APP_VERSION=1.0.0
MAX_CONNECTIONS=1000

# Logging configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log
LOG_MAX_SIZE=100mb
LOG_MAX_FILES=5

# Performance settings
CLUSTER_INSTANCES=max
MAX_MEMORY_RESTART=1G
GRACEFUL_SHUTDOWN_TIMEOUT=30000

# Health check settings
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000

# Security settings
TRUST_PROXY=true
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=1000
```

### Environment Loading

Implement environment variable loading in your server:

```javascript
// config/environment.js
const dotenv = require('dotenv');
const path = require('path');

// Load environment-specific configuration
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env.development';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

module.exports = {
  app: {
    name: process.env.APP_NAME || 'hello-world-server',
    version: process.env.APP_VERSION || '1.0.0',
    port: parseInt(process.env.PORT, 10) || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  performance: {
    maxConnections: parseInt(process.env.MAX_CONNECTIONS, 10) || 1000,
    maxMemoryRestart: process.env.MAX_MEMORY_RESTART || '1G',
    gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT, 10) || 30000
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '100mb',
    maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 5
  },
  
  cluster: {
    instances: process.env.CLUSTER_INSTANCES || 'max'
  }
};
```

## Monitoring Setup

### PM2 Built-in Monitoring

Enable comprehensive monitoring with PM2:

```bash
# Start application with monitoring
pm2 start ecosystem.config.js --env production

# Enable PM2 web dashboard
pm2 web

# Monitor real-time logs
pm2 logs hello-world-server

# Monitor real-time metrics
pm2 monit

# Generate monitoring reports
pm2 report
```

### Health Check Implementation

Implement health check endpoints:

```javascript
// health.js - Health check module
const http = require('http');
const { performance } = require('perf_hooks');

class HealthChecker {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
  }

  // Basic health check
  basicHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      memory: process.memoryUsage(),
      pid: process.pid
    };
  }

  // Detailed health check
  detailedHealth() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      
      system: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      
      memory: {
        rss: this.formatBytes(memUsage.rss),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        heapUsed: this.formatBytes(memUsage.heapUsed),
        external: this.formatBytes(memUsage.external)
      },
      
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      
      metrics: {
        requests: this.requestCount,
        errors: this.errorCount,
        errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0
      }
    };
  }

  formatBytes(bytes) {
    return `${Math.round(bytes / 1024 / 1024 * 100) / 100} MB`;
  }

  incrementRequests() {
    this.requestCount++;
  }

  incrementErrors() {
    this.errorCount++;
  }
}

module.exports = HealthChecker;
```

### PM2 Monitoring Integration

Configure advanced monitoring with PM2:

```javascript
// monitoring.config.js
module.exports = {
  apps: [
    {
      name: 'hello-world-monitored',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      
      // Enhanced monitoring
      monitoring: true,
      pmx: {
        http: true,
        ignore_routes: ['/health', '/metrics'],
        errors: true,
        custom_probes: true,
        network: true,
        ports: true
      },
      
      // Custom metrics
      instance_var: 'INSTANCE_ID',
      
      // Alert configuration
      alert_enabled: true,
      alert_memory_limit: '1GB',
      alert_cpu_limit: 80,
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        MONITORING_ENABLED: true
      }
    }
  ]
};
```

## Scaling Strategies

### Horizontal Scaling with PM2 Cluster Mode

PM2 provides built-in cluster mode for horizontal scaling:

```javascript
// cluster.config.js
module.exports = {
  apps: [
    {
      name: 'hello-world-cluster',
      script: './server.js',
      
      // Scaling configuration
      instances: 'max', // Uses all available CPU cores
      exec_mode: 'cluster',
      
      // Alternative specific instance count
      // instances: 4,
      
      // Load balancing
      listen_timeout: 8000,
      kill_timeout: 5000,
      
      // Performance optimization
      node_args: [
        '--max-old-space-size=1024',
        '--optimize-for-size'
      ],
      
      // Cluster-specific settings
      increment_var: 'PORT',
      combine_logs: true,
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```

### Dynamic Scaling

Implement dynamic scaling based on load:

```javascript
// scaling.js - Dynamic scaling helper
const pm2 = require('pm2');
const os = require('os');

class AutoScaler {
  constructor(appName, options = {}) {
    this.appName = appName;
    this.minInstances = options.minInstances || 1;
    this.maxInstances = options.maxInstances || os.cpus().length;
    this.scaleUpThreshold = options.scaleUpThreshold || 80; // CPU %
    this.scaleDownThreshold = options.scaleDownThreshold || 30; // CPU %
    this.checkInterval = options.checkInterval || 60000; // 1 minute
  }

  start() {
    setInterval(() => this.checkAndScale(), this.checkInterval);
    console.log(`Auto-scaler started for ${this.appName}`);
  }

  async checkAndScale() {
    try {
      const processes = await this.getProcessInfo();
      const avgCpu = this.calculateAverageCpu(processes);
      const currentInstances = processes.length;

      console.log(`Current instances: ${currentInstances}, Average CPU: ${avgCpu}%`);

      if (avgCpu > this.scaleUpThreshold && currentInstances < this.maxInstances) {
        await this.scaleUp();
      } else if (avgCpu < this.scaleDownThreshold && currentInstances > this.minInstances) {
        await this.scaleDown();
      }
    } catch (error) {
      console.error('Scaling check failed:', error);
    }
  }

  async getProcessInfo() {
    return new Promise((resolve, reject) => {
      pm2.describe(this.appName, (err, processInfo) => {
        if (err) reject(err);
        else resolve(processInfo);
      });
    });
  }

  calculateAverageCpu(processes) {
    if (processes.length === 0) return 0;
    
    const totalCpu = processes.reduce((sum, proc) => {
      return sum + (proc.monit ? proc.monit.cpu : 0);
    }, 0);
    
    return totalCpu / processes.length;
  }

  async scaleUp() {
    return new Promise((resolve, reject) => {
      pm2.scale(this.appName, '+1', (err) => {
        if (err) {
          console.error('Scale up failed:', err);
          reject(err);
        } else {
          console.log(`Scaled up ${this.appName}`);
          resolve();
        }
      });
    });
  }

  async scaleDown() {
    return new Promise((resolve, reject) => {
      pm2.scale(this.appName, '-1', (err) => {
        if (err) {
          console.error('Scale down failed:', err);
          reject(err);
        } else {
          console.log(`Scaled down ${this.appName}`);
          resolve();
        }
      });
    });
  }
}

module.exports = AutoScaler;
```

## Deployment Workflow

### Automated Deployment Script

Create a comprehensive deployment script:

```bash
#!/bin/bash
# deploy.sh - Production deployment script

set -e

# Configuration
APP_NAME="hello-world-server"
DEPLOY_USER="deploy"
DEPLOY_PATH="/var/www/hello-world-server"
BACKUP_PATH="/var/backups/hello-world-server"
LOG_FILE="/var/log/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a $LOG_FILE
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a $LOG_FILE
}

# Pre-deployment checks
pre_deploy_checks() {
    log "Starting pre-deployment checks..."
    
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        error "PM2 is not installed"
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    MIN_VERSION="14.0.0"
    if ! [[ "$(printf '%s\n' "$MIN_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$MIN_VERSION" ]]; then
        error "Node.js version $NODE_VERSION is below minimum required version $MIN_VERSION"
    fi
    
    # Check available disk space
    AVAILABLE_SPACE=$(df $DEPLOY_PATH | awk 'NR==2{print $4}')
    MIN_SPACE=1048576 # 1GB in KB
    if [ "$AVAILABLE_SPACE" -lt "$MIN_SPACE" ]; then
        error "Insufficient disk space. Available: ${AVAILABLE_SPACE}KB, Required: ${MIN_SPACE}KB"
    fi
    
    log "Pre-deployment checks passed"
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    BACKUP_DIR="$BACKUP_PATH/$(date +'%Y%m%d_%H%M%S')"
    mkdir -p "$BACKUP_DIR"
    
    if [ -d "$DEPLOY_PATH" ]; then
        cp -r "$DEPLOY_PATH" "$BACKUP_DIR/"
        log "Backup created at $BACKUP_DIR"
    else
        warn "No existing deployment found to backup"
    fi
}

# Download and extract application
deploy_application() {
    log "Deploying application..."
    
    # Create deployment directory
    mkdir -p "$DEPLOY_PATH"
    cd "$DEPLOY_PATH"
    
    # Pull latest code (assuming git repository)
    if [ -d ".git" ]; then
        git pull origin main
    else
        # If first deployment, clone repository
        git clone https://github.com/your-repo/hello-world-server.git .
    fi
    
    # Install dependencies
    npm ci --only=production
    
    log "Application deployed successfully"
}

# Update PM2 configuration
update_pm2() {
    log "Updating PM2 configuration..."
    
    # Stop existing processes gracefully
    if pm2 describe "$APP_NAME" &> /dev/null; then
        pm2 stop "$APP_NAME"
        pm2 delete "$APP_NAME"
    fi
    
    # Start application with new configuration
    pm2 start ecosystem.config.js --env production
    
    # Save PM2 configuration
    pm2 save
    
    log "PM2 configuration updated"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for application to start
    sleep 5
    
    # Check if application is responding
    MAX_ATTEMPTS=30
    ATTEMPT=1
    
    while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            log "Health check passed"
            return 0
        fi
        
        log "Health check attempt $ATTEMPT/$MAX_ATTEMPTS failed, retrying..."
        sleep 2
        ((ATTEMPT++))
    done
    
    error "Health check failed after $MAX_ATTEMPTS attempts"
}

# Cleanup old backups
cleanup_backups() {
    log "Cleaning up old backups..."
    
    # Keep only last 5 backups
    find "$BACKUP_PATH" -maxdepth 1 -type d -name "*_*" | sort -r | tail -n +6 | xargs rm -rf
    
    log "Backup cleanup completed"
}

# Main deployment function
main() {
    log "Starting deployment of $APP_NAME"
    
    pre_deploy_checks
    create_backup
    deploy_application
    update_pm2
    health_check
    cleanup_backups
    
    log "Deployment completed successfully"
    
    # Display status
    pm2 status
    pm2 logs "$APP_NAME" --lines 10
}

# Error handling
trap 'error "Deployment failed"' ERR

# Run main function
main "$@"
```

### Zero-Downtime Deployment

Implement zero-downtime deployment strategy:

```javascript
// zero-downtime-deploy.js
const pm2 = require('pm2');
const http = require('http');

class ZeroDowntimeDeployer {
  constructor(appName, options = {}) {
    this.appName = appName;
    this.healthCheckUrl = options.healthCheckUrl || 'http://localhost:3000/health';
    this.healthCheckTimeout = options.healthCheckTimeout || 5000;
    this.maxHealthCheckAttempts = options.maxHealthCheckAttempts || 30;
    this.gracefulShutdownTimeout = options.gracefulShutdownTimeout || 30000;
  }

  async deploy() {
    console.log('Starting zero-downtime deployment...');
    
    try {
      // Step 1: Start new instances
      await this.startNewInstances();
      
      // Step 2: Health check new instances
      await this.healthCheckNewInstances();
      
      // Step 3: Gracefully shutdown old instances
      await this.shutdownOldInstances();
      
      // Step 4: Update configuration
      await this.updateConfiguration();
      
      console.log('Zero-downtime deployment completed successfully');
    } catch (error) {
      console.error('Deployment failed:', error);
      await this.rollback();
      throw error;
    }
  }

  async startNewInstances() {
    return new Promise((resolve, reject) => {
      pm2.start({
        name: `${this.appName}-new`,
        script: './server.js',
        instances: 'max',
        exec_mode: 'cluster',
        env: {
          NODE_ENV: 'production',
          PORT: 3001 // Temporary port for new instances
        }
      }, (err) => {
        if (err) reject(err);
        else {
          console.log('New instances started');
          resolve();
        }
      });
    });
  }

  async healthCheckNewInstances() {
    console.log('Performing health check on new instances...');
    
    for (let attempt = 1; attempt <= this.maxHealthCheckAttempts; attempt++) {
      try {
        await this.makeHealthCheckRequest('http://localhost:3001/health');
        console.log('Health check passed for new instances');
        return;
      } catch (error) {
        if (attempt === this.maxHealthCheckAttempts) {
          throw new Error(`Health check failed after ${this.maxHealthCheckAttempts} attempts`);
        }
        console.log(`Health check attempt ${attempt}/${this.maxHealthCheckAttempts} failed, retrying...`);
        await this.sleep(2000);
      }
    }
  }

  async shutdownOldInstances() {
    return new Promise((resolve, reject) => {
      pm2.gracefulReload(this.appName, (err) => {
        if (err) reject(err);
        else {
          console.log('Old instances shutdown gracefully');
          resolve();
        }
      });
    });
  }

  async updateConfiguration() {
    // Update new instances to use production port
    return new Promise((resolve, reject) => {
      pm2.restart(`${this.appName}-new`, {
        env: {
          NODE_ENV: 'production',
          PORT: 3000
        }
      }, (err) => {
        if (err) reject(err);
        else {
          console.log('Configuration updated');
          resolve();
        }
      });
    });
  }

  async rollback() {
    console.log('Rolling back deployment...');
    
    // Stop new instances
    await new Promise((resolve) => {
      pm2.stop(`${this.appName}-new`, () => {
        pm2.delete(`${this.appName}-new`, () => resolve());
      });
    });
    
    // Restart old instances if they exist
    await new Promise((resolve) => {
      pm2.restart(this.appName, () => {
        console.log('Rollback completed');
        resolve();
      });
    });
  }

  makeHealthCheckRequest(url) {
    return new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Health check failed with status ${res.statusCode}`));
        }
      });
      
      req.setTimeout(this.healthCheckTimeout, () => {
        req.abort();
        reject(new Error('Health check timeout'));
      });
      
      req.on('error', reject);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ZeroDowntimeDeployer;
```

## Maintenance Procedures

### Regular Maintenance Tasks

Create scheduled maintenance procedures:

```bash
#!/bin/bash
# maintenance.sh - Regular maintenance tasks

APP_NAME="hello-world-server"
LOG_DIR="/var/log/hello-world-server"
BACKUP_DIR="/var/backups/hello-world-server"

# Log rotation
rotate_logs() {
    echo "Rotating application logs..."
    
    # Create log directory if it doesn't exist
    mkdir -p "$LOG_DIR"
    
    # Rotate PM2 logs
    pm2 flush
    
    # Compress old logs
    find "$LOG_DIR" -name "*.log" -mtime +7 -exec gzip {} \;
    
    # Remove very old compressed logs
    find "$LOG_DIR" -name "*.log.gz" -mtime +30 -delete
    
    echo "Log rotation completed"
}

# Memory optimization
optimize_memory() {
    echo "Optimizing memory usage..."
    
    # Get memory usage for each process
    pm2 describe "$APP_NAME" | grep -E "(memory|cpu)"
    
    # Restart processes with high memory usage
    pm2 reload "$APP_NAME"
    
    echo "Memory optimization completed"
}

# Update dependencies
update_dependencies() {
    echo "Checking for dependency updates..."
    
    cd /var/www/hello-world-server
    
    # Check for outdated packages
    npm outdated
    
    # Update security vulnerabilities
    npm audit fix --only=prod
    
    echo "Dependency update completed"
}

# Database cleanup (if applicable)
cleanup_database() {
    echo "Performing database cleanup..."
    
    # Add database cleanup tasks here
    # Example: Remove old session data, logs, etc.
    
    echo "Database cleanup completed"
}

# System health check
system_health_check() {
    echo "Performing system health check..."
    
    # Check disk space
    df -h | grep -E "(Filesystem|/dev/)"
    
    # Check memory usage
    free -h
    
    # Check CPU load
    uptime
    
    # Check PM2 process status
    pm2 status
    
    # Check application health
    curl -f http://localhost:3000/health || echo "Health check failed"
    
    echo "System health check completed"
}

# Main maintenance function
main() {
    echo "Starting maintenance tasks at $(date)"
    
    rotate_logs
    optimize_memory
    update_dependencies
    cleanup_database
    system_health_check
    
    echo "Maintenance tasks completed at $(date)"
}

# Run maintenance
main >> /var/log/maintenance.log 2>&1
```

### Automated Maintenance Cron Jobs

Set up automated maintenance:

```bash
# crontab -e
# Add the following entries:

# Daily log rotation (2 AM)
0 2 * * * /opt/scripts/maintenance.sh rotate_logs

# Weekly memory optimization (Sunday 3 AM)  
0 3 * * 0 /opt/scripts/maintenance.sh optimize_memory

# Monthly dependency updates (1st day of month, 4 AM)
0 4 1 * * /opt/scripts/maintenance.sh update_dependencies

# Daily health checks (every 6 hours)
0 */6 * * * /opt/scripts/maintenance.sh system_health_check

# Weekly full maintenance (Saturday 1 AM)
0 1 * * 6 /opt/scripts/maintenance.sh
```

## Performance Optimization

### Node.js Performance Tuning

Optimize Node.js performance for production:

```javascript
// performance.config.js
module.exports = {
  apps: [
    {
      name: 'hello-world-optimized',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      
      // V8 Engine optimizations
      node_args: [
        '--max-old-space-size=1024',        // Increase heap size
        '--optimize-for-size',               // Optimize for memory usage
        '--max-semi-space-size=64',          // Optimize garbage collection
        '--expose-gc',                       // Allow manual garbage collection
        '--trace-warnings',                  // Show stack traces for warnings
        '--unhandled-rejections=strict'      // Strict unhandled rejection mode
      ],
      
      // Process optimization
      max_memory_restart: '1G',
      min_uptime: '30s',
      max_restarts: 3,
      
      // Performance monitoring
      monitoring: {
        http: true,
        https: true,
        network: true,
        memory: true,
        cpu: true
      },
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        UV_THREADPOOL_SIZE: 128,  // Increase thread pool size
        NODE_OPTIONS: '--max-old-space-size=1024'
      }
    }
  ]
};
```

### Connection Pooling and Optimization

Implement connection optimization:

```javascript
// performance/connection-pool.js
const http = require('http');
const cluster = require('cluster');

class ConnectionManager {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || 1000;
    this.keepAliveTimeout = options.keepAliveTimeout || 65000;
    this.headersTimeout = options.headersTimeout || 66000;
    this.requestTimeout = options.requestTimeout || 30000;
    this.activeConnections = 0;
  }

  configureServer(server) {
    // Configure server timeouts
    server.keepAliveTimeout = this.keepAliveTimeout;
    server.headersTimeout = this.headersTimeout;
    server.requestTimeout = this.requestTimeout;
    
    // Configure connection limits
    server.maxConnections = this.maxConnections;
    
    // Connection tracking
    server.on('connection', (socket) => {
      this.activeConnections++;
      console.log(`New connection. Active: ${this.activeConnections}`);
      
      socket.on('close', () => {
        this.activeConnections--;
        console.log(`Connection closed. Active: ${this.activeConnections}`);
      });
    });
    
    // Graceful shutdown handling
    server.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    });
    
    return server;
  }

  getStats() {
    return {
      activeConnections: this.activeConnections,
      maxConnections: this.maxConnections,
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
}

module.exports = ConnectionManager;
```

### Caching Strategy

Implement caching for improved performance:

```javascript
// performance/cache.js
const LRU = require('lru-cache');

class CacheManager {
  constructor(options = {}) {
    this.cache = new LRU({
      max: options.maxItems || 1000,
      maxAge: options.maxAge || 1000 * 60 * 60, // 1 hour
      updateAgeOnGet: true,
      stale: true
    });
    
    this.hitCount = 0;
    this.missCount = 0;
  }

  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hitCount++;
      return value;
    } else {
      this.missCount++;
      return null;
    }
  }

  set(key, value, maxAge = null) {
    const options = maxAge ? { maxAge } : {};
    this.cache.set(key, value, options);
  }

  del(key) {
    this.cache.del(key);
  }

  clear() {
    this.cache.reset();
    this.hitCount = 0;
    this.missCount = 0;
  }

  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? (this.hitCount / total * 100).toFixed(2) + '%' : '0%',
      itemCount: this.cache.itemCount,
      length: this.cache.length
    };
  }
}

// Usage in server
const cache = new CacheManager({
  maxItems: 1000,
  maxAge: 1000 * 60 * 60 // 1 hour
});

// Cache middleware for responses
function cacheMiddleware(req, res, next) {
  const key = req.url;
  const cached = cache.get(key);
  
  if (cached) {
    console.log(`Cache hit for ${key}`);
    res.writeHead(200, cached.headers);
    res.end(cached.body);
    return;
  }
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to cache response
  res.end = function(chunk, encoding) {
    if (res.statusCode === 200) {
      cache.set(key, {
        headers: res.getHeaders(),
        body: chunk
      });
    }
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

module.exports = { CacheManager, cacheMiddleware };
```

## Security Considerations

### Production Security Checklist

Essential security measures for production deployment:

```bash
#!/bin/bash
# security-check.sh - Production security checklist

echo "Production Security Checklist"
echo "============================="

# Check Node.js version
echo "1. Node.js Version Check:"
NODE_VERSION=$(node --version)
echo "   Current version: $NODE_VERSION"
if [[ "$NODE_VERSION" < "v14.0.0" ]]; then
    echo "   ⚠️  WARNING: Node.js version is outdated"
else
    echo "   ✅ Node.js version is acceptable"
fi

# Check for security vulnerabilities
echo "2. Security Vulnerability Check:"
npm audit --audit-level high
if [ $? -eq 0 ]; then
    echo "   ✅ No high-severity vulnerabilities found"
else
    echo "   ⚠️  WARNING: Security vulnerabilities detected"
fi

# Check file permissions
echo "3. File Permissions Check:"
find /var/www/hello-world-server -type f -perm -o+w
if [ $? -eq 0 ]; then
    echo "   ⚠️  WARNING: World-writable files found"
else
    echo "   ✅ File permissions are secure"
fi

# Check process user
echo "4. Process User Check:"
PM2_USER=$(pm2 status | grep hello-world-server | awk '{print $2}')
if [[ "$PM2_USER" == "root" ]]; then
    echo "   ⚠️  WARNING: Application running as root"
else
    echo "   ✅ Application running as non-root user"
fi

# Check firewall status
echo "5. Firewall Check:"
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status | head -1)
    echo "   $UFW_STATUS"
    if [[ "$UFW_STATUS" == *"inactive"* ]]; then
        echo "   ⚠️  WARNING: Firewall is inactive"
    else
        echo "   ✅ Firewall is active"
    fi
fi

echo "Security check completed"
```

### Environment Security

Secure environment configuration:

```bash
# .env.production.secure
NODE_ENV=production
PORT=3000

# Security settings
TRUST_PROXY=1
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Logging security
LOG_SENSITIVE_DATA=false
LOG_LEVEL=warn

# Process security
RUN_AS_USER=nodejs
RUN_AS_GROUP=nodejs

# Network security
ALLOWED_HOSTS=localhost,production-server.com
CORS_ORIGIN=https://production-app.com

# Monitoring security
DISABLE_X_POWERED_BY=true
HIDE_SERVER_HEADER=true
```

## Troubleshooting

### Common Production Issues

#### Issue 1: High Memory Usage

**Symptoms:**
- Application processes consuming excessive memory
- PM2 frequently restarting processes due to memory limits
- System becoming unresponsive

**Diagnosis:**
```bash
# Check memory usage
pm2 monit
free -h
cat /proc/meminfo

# Check for memory leaks
pm2 logs --lines 100 | grep -i "memory\|heap\|gc"
```

**Solutions:**
```bash
# Reduce memory limit
pm2 restart app --max-memory-restart 512M

# Enable garbage collection optimization
pm2 restart app --node-args="--optimize-for-size --max-old-space-size=512"

# Implement memory monitoring
pm2 install pm2-server-monit
```

#### Issue 2: High CPU Usage

**Symptoms:**
- CPU usage consistently above 80%
- Slow response times
- Request timeouts

**Diagnosis:**
```bash
# Check CPU usage
top -p $(pgrep -f "hello-world-server")
pm2 monit

# Profile CPU usage
node --prof server.js
node --prof-process isolate-*.log > processed.txt
```

**Solutions:**
```bash
# Reduce instance count
pm2 scale hello-world-server 2

# Optimize Node.js arguments
pm2 restart hello-world-server --node-args="--optimize-for-size"

# Implement load balancing
# Configure nginx as reverse proxy
```

#### Issue 3: Process Crashes

**Symptoms:**
- PM2 shows processes in "errored" state
- Frequent automatic restarts
- Application unavailable intermittently

**Diagnosis:**
```bash
# Check error logs
pm2 logs hello-world-server --err --lines 50

# Check system logs
journalctl -u pm2-nodejs -n 50

# Monitor process status
pm2 status
pm2 describe hello-world-server
```

**Solutions:**
```bash
# Increase restart limits
pm2 restart hello-world-server --max-restarts 10 --min-uptime 30s

# Enable uncaught exception handling
pm2 restart hello-world-server --kill-timeout 5000

# Implement graceful shutdown
# Add signal handlers in application code
```

### Debugging Tools

Essential debugging tools for production:

```javascript
// debug-tools.js
const util = require('util');
const fs = require('fs');
const path = require('path');

class ProductionDebugger {
  constructor(options = {}) {
    this.logFile = options.logFile || path.join(process.cwd(), 'debug.log');
    this.enabled = process.env.DEBUG_ENABLED === 'true';
  }

  // Memory analysis
  analyzeMemory() {
    const memUsage = process.memoryUsage();
    const analysis = {
      timestamp: new Date().toISOString(),
      pid: process.pid,
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024 * 100) / 100} MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024 * 100) / 100} MB`,
        heapUtilization: `${Math.round(memUsage.heapUsed / memUsage.heapTotal * 100)}%`
      }
    };
    
    this.log('MEMORY_ANALYSIS', analysis);
    return analysis;
  }

  // CPU analysis
  analyzeCPU() {
    const cpuUsage = process.cpuUsage();
    const analysis = {
      timestamp: new Date().toISOString(),
      pid: process.pid,
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        total: cpuUsage.user + cpuUsage.system
      },
      uptime: process.uptime()
    };
    
    this.log('CPU_ANALYSIS', analysis);
    return analysis;
  }

  // Event loop analysis
  analyzeEventLoop() {
    const { performance } = require('perf_hooks');
    const start = performance.now();
    
    setImmediate(() => {
      const lag = performance.now() - start;
      const analysis = {
        timestamp: new Date().toISOString(),
        pid: process.pid,
        eventLoopLag: `${lag.toFixed(2)}ms`,
        healthy: lag < 10 // Less than 10ms is considered healthy
      };
      
      this.log('EVENT_LOOP_ANALYSIS', analysis);
    });
  }

  // Generate heap snapshot
  generateHeapSnapshot() {
    if (!this.enabled) return;
    
    const v8 = require('v8');
    const heapSnapshot = v8.writeHeapSnapshot();
    
    this.log('HEAP_SNAPSHOT', {
      timestamp: new Date().toISOString(),
      file: heapSnapshot,
      message: 'Heap snapshot generated'
    });
    
    return heapSnapshot;
  }

  // Log debug information
  log(level, data) {
    if (!this.enabled) return;
    
    const logEntry = {
      level,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      data
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(this.logFile, logLine);
  }

  // Start monitoring
  startMonitoring(interval = 30000) {
    if (!this.enabled) return;
    
    console.log(`Starting production monitoring (interval: ${interval}ms)`);
    
    setInterval(() => {
      this.analyzeMemory();
      this.analyzeCPU();
      this.analyzeEventLoop();
    }, interval);
  }
}

module.exports = ProductionDebugger;
```

## Best Practices

### Production Deployment Best Practices

1. **Environment Separation**
   - Use separate configurations for development, staging, and production
   - Never expose sensitive data in environment variables
   - Use secrets management for API keys and credentials

2. **Process Management**
   - Always use PM2 cluster mode for high availability
   - Set appropriate memory limits and restart policies
   - Implement graceful shutdown handling

3. **Monitoring and Alerting**
   - Set up comprehensive monitoring for all critical metrics
   - Configure alerts for high CPU, memory, and error rates
   - Implement health checks and automated recovery

4. **Security**
   - Run processes with minimal required privileges
   - Keep dependencies updated and scan for vulnerabilities
   - Implement proper logging without sensitive data exposure

5. **Performance**
   - Use appropriate caching strategies
   - Optimize Node.js runtime flags for your workload
   - Monitor and tune garbage collection settings

6. **Deployment**
   - Use automated deployment pipelines
   - Implement zero-downtime deployment strategies
   - Maintain rollback capabilities

7. **Backup and Recovery**
   - Implement regular backup procedures
   - Test recovery procedures regularly
   - Document disaster recovery plans

### Configuration Management

```yaml
# production.yml - Configuration template
application:
  name: hello-world-server
  version: 1.0.0
  environment: production

server:
  port: 3000
  host: 0.0.0.0
  timeout: 30000

clustering:
  instances: max
  exec_mode: cluster
  max_memory_restart: 1G

logging:
  level: info
  file: /var/log/hello-world-server/app.log
  max_size: 100MB
  max_files: 5

monitoring:
  enabled: true
  health_check_interval: 30000
  metrics_collection: true

security:
  rate_limiting:
    enabled: true
    window_ms: 900000
    max_requests: 1000
  
  headers:
    trust_proxy: true
    hide_powered_by: true

performance:
  gc_optimization: true
  memory_optimization: true
  connection_pooling: true
```

This comprehensive production deployment guide provides all the necessary information, procedures, and best practices for successfully deploying and maintaining the Node.js Hello World server in production environments. The guide covers everything from basic PM2 setup to advanced monitoring, scaling, and troubleshooting procedures, ensuring high availability and optimal performance in production deployments.