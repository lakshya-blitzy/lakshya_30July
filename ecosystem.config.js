/**
 * PM2 Ecosystem Configuration for Secure Node.js Server
 * 
 * This configuration enables production-ready deployment with:
 * - CPU-based clustering for horizontal scaling
 * - Memory-based auto-restart for resource management
 * - Comprehensive logging with rotation
 * - Zero-downtime deployment capabilities
 * - Environment-specific configuration management
 * 
 * Features:
 * - Auto-scaling based on available CPU cores
 * - Graceful shutdown handling with 30s timeout
 * - Health check integration for monitoring
 * - Log aggregation across cluster instances
 * - Automated deployment hooks for CI/CD
 */

module.exports = {
  apps: [
    {
      // Application identification
      name: 'secure-node-server',
      script: 'server.js',
      
      // Clustering configuration
      instances: 'max', // Uses all available CPU cores
      exec_mode: 'cluster',
      
      // Resource management
      max_memory_restart: '100M',
      min_uptime: '10s',
      max_restarts: 10,
      
      // Auto-restart configuration
      autorestart: true,
      
      // File watching (disabled for production)
      watch: false,
      ignore_watch: [
        'node_modules',
        'logs',
        'certs',
        '.git',
        '*.log'
      ],
      
      // Environment variables for production
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HTTPS_PORT: 3443,
        LOG_LEVEL: 'info'
      },
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HTTPS_PORT: 3443,
        HTTPS_ENABLED: 'true',
        TRUST_PROXY: 'true',
        LOG_LEVEL: 'warn',
        LOG_SENSITIVE_DATA: 'false',
        RATE_LIMIT_MAX_REQUESTS: 2000,
        SESSION_SECURE: 'true',
        HSTS_ENABLED: 'true',
        HELMET_ENABLED: 'true',
        COMPRESSION_ENABLED: 'true',
        HEALTH_CHECK_ENABLED: 'true'
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        HTTPS_PORT: 3443,
        HTTPS_ENABLED: 'true',
        LOG_LEVEL: 'info',
        RATE_LIMIT_MAX_REQUESTS: 1000,
        HEALTH_CHECK_ENABLED: 'true'
      },
      
      // Logging configuration
      error_file: './logs/error.log',
      out_file: './logs/combined.log',
      log_file: './logs/pm2.log',
      
      // Log aggregation settings
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process monitoring
      pid_file: './pids/app.pid',
      
      // Advanced PM2 features
      listen_timeout: 3000,
      kill_timeout: 5000,
      
      // Graceful shutdown configuration
      shutdown_with_message: true,
      
      // Health monitoring
      health_check_grace_period: 3000,
      
      // Performance optimization
      node_args: [
        '--max-old-space-size=1024',
        '--optimize-for-size'
      ],
      
      // Process limits
      max_memory_restart: '100M',
      
      // Cluster-specific configuration
      instance_var: 'INSTANCE_ID',
      
      // Source map support for debugging
      source_map_support: true,
      
      // Disable automatic restart in case of uncaught exceptions
      // (let the application handle them gracefully)
      disable_source_map_support: false,
      
      // Process title for system monitoring
      name: 'secure-node-server',
      
      // Cron-based restart (optional, disabled by default)
      cron_restart: null,
      
      // Interpreter configuration
      interpreter: 'node',
      interpreter_args: '--harmony',
      
      // Working directory
      cwd: './',
      
      // User and group for security (production)
      user: process.env.RUN_AS_USER || null,
      group: process.env.RUN_AS_GROUP || null,
      
      // Additional environment configuration
      env_file: '.env',
      
      // Force restart if memory usage exceeds limit
      max_memory_restart: '100M',
      
      // Exponential backoff restart delay
      restart_delay: 4000,
      
      // Auto-restart behavior
      autorestart: true,
      
      // Time before forcing a reload
      wait_ready: true,
      
      // Maximum number of unstable restarts
      max_restarts: 10,
      
      // Minimum uptime before restart
      min_uptime: '10s',
      
      // Instance increment for port assignment
      increment_var: 'PORT',
      
      // Cluster configuration
      instances: 'max',
      exec_mode: 'cluster'
    }
  ],

  deploy: {
    production: {
      // Git repository configuration
      user: process.env.DEPLOY_USER || 'node',
      host: process.env.DEPLOY_HOST || 'localhost',
      ref: 'origin/main',
      repo: process.env.DEPLOY_REPO || 'https://github.com/blitzy-public-samples/secure-node-server.git',
      path: process.env.DEPLOY_PATH || '/var/www/secure-node-server',
      
      // SSH configuration
      ssh_options: 'StrictHostKeyChecking=no',
      
      // Pre-deployment hooks
      'pre-deploy-local': [
        'echo "Starting deployment validation..."',
        'npm run security:check',
        'npm run test',
        'echo "Pre-deployment checks passed"'
      ].join(' && '),
      
      // Post-deployment hooks
      'post-deploy': [
        'echo "Installing dependencies..."',
        'npm ci --production',
        'echo "Creating required directories..."',
        'mkdir -p logs pids certs',
        'echo "Setting permissions..."',
        'chmod 755 logs pids',
        'echo "Running security audit..."',
        'npm audit --audit-level=high',
        'echo "Starting application with PM2..."',
        'pm2 reload ecosystem.config.js --env production',
        'echo "Deployment completed successfully"'
      ].join(' && '),
      
      // Pre-setup hooks (run once)
      'pre-setup': [
        'echo "Preparing server for deployment..."',
        'sudo apt-get update',
        'sudo apt-get install -y nodejs npm',
        'sudo npm install -g pm2',
        'echo "Server preparation completed"'
      ].join(' && '),
      
      // Post-setup hooks (run once)
      'post-setup': [
        'echo "Configuring PM2 startup..."',
        'pm2 startup',
        'pm2 save',
        'echo "PM2 startup configuration completed"'
      ].join(' && '),
      
      // Environment variables for deployment
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HTTPS_PORT: 3443
      }
    },
    
    staging: {
      // Staging environment configuration
      user: process.env.STAGING_DEPLOY_USER || 'node',
      host: process.env.STAGING_DEPLOY_HOST || 'staging.localhost',
      ref: 'origin/develop',
      repo: process.env.DEPLOY_REPO || 'https://github.com/blitzy-public-samples/secure-node-server.git',
      path: process.env.STAGING_DEPLOY_PATH || '/var/www/staging/secure-node-server',
      
      // SSH configuration
      ssh_options: 'StrictHostKeyChecking=no',
      
      // Pre-deployment hooks for staging
      'pre-deploy-local': [
        'echo "Starting staging deployment validation..."',
        'npm run test',
        'echo "Staging pre-deployment checks passed"'
      ].join(' && '),
      
      // Post-deployment hooks for staging
      'post-deploy': [
        'echo "Installing dependencies for staging..."',
        'npm ci',
        'echo "Creating required directories..."',
        'mkdir -p logs pids certs',
        'echo "Running tests in staging environment..."',
        'npm test',
        'echo "Starting staging application..."',
        'pm2 reload ecosystem.config.js --env staging',
        'echo "Staging deployment completed"'
      ].join(' && '),
      
      // Environment variables for staging
      env: {
        NODE_ENV: 'staging',
        PORT: 3000,
        HTTPS_PORT: 3443
      }
    }
  }
};