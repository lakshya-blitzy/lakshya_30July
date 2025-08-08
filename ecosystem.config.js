/**
 * PM2 Ecosystem Configuration for secure-node-server
 * 
 * This configuration enables production deployment with:
 * - CPU-based clustering (max instances)
 * - Auto-restart on memory limits
 * - Zero-downtime deployment
 * - Log rotation and monitoring
 */

module.exports = {
  apps: [
    {
      name: 'secure-node-server',
      script: 'server.js',
      instances: 'max', // CPU-based clustering
      exec_mode: 'cluster',
      max_memory_restart: '100M',
      env: {
        NODE_ENV: 'production',
        USE_EXPRESS: 'true',
        PORT: 3000,
        HTTPS_PORT: 3443
      },
      env_production: {
        NODE_ENV: 'production',
        USE_EXPRESS: 'true',
        PORT: 3000,
        HTTPS_PORT: 3443
      },
      // Logging configuration
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      watch: false, // Disabled for production
      ignore_watch: ['node_modules', 'logs', '.git'],
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Health check
      health_check_grace_period: 3000,
      
      // Process optimization
      node_args: '--max-old-space-size=512',
      kill_timeout: 5000
    }
  ],
  
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-org/secure-node-server.git',
      path: '/var/www/production',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --only=production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};