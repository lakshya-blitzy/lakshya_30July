"""
WSGI Entry Point for Flask Application

This module provides the WSGI-compatible application object for production
deployment with Gunicorn server, similar to PM2 clustering for Node.js.

Usage:
    gunicorn --config gunicorn.conf.py wsgi:application
    gunicorn --workers 4 --bind 0.0.0.0:5000 wsgi:application
"""

import os
import logging
import multiprocessing
from app import app

# Configure logging to match Winston structured logging approach
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/flask-app.log', mode='a') if os.path.exists('logs') else logging.NullHandler()
    ]
)

logger = logging.getLogger(__name__)

# WSGI application object for Gunicorn discovery
application = app

# Configuration for Gunicorn (can be overridden by gunicorn.conf.py)
def configure_gunicorn():
    """
    Configure Gunicorn settings for production deployment
    Similar to PM2 clustering configuration
    """
    # Worker configuration based on CPU cores (similar to PM2 'max' instances)
    workers = int(os.environ.get('GUNICORN_WORKERS', multiprocessing.cpu_count()))
    
    # Connection settings
    bind = os.environ.get('GUNICORN_BIND', '0.0.0.0:5000')
    
    # Process management
    max_requests = int(os.environ.get('GUNICORN_MAX_REQUESTS', 1000))
    max_requests_jitter = int(os.environ.get('GUNICORN_MAX_REQUESTS_JITTER', 100))
    
    # Timeout settings
    timeout = int(os.environ.get('GUNICORN_TIMEOUT', 30))
    keepalive = int(os.environ.get('GUNICORN_KEEPALIVE', 2))
    
    # Log configuration
    access_log = os.environ.get('GUNICORN_ACCESS_LOG', '-')
    error_log = os.environ.get('GUNICORN_ERROR_LOG', '-')
    
    logger.info(f"Gunicorn configuration:")
    logger.info(f"  Workers: {workers}")
    logger.info(f"  Bind: {bind}")
    logger.info(f"  Max requests: {max_requests}")
    logger.info(f"  Timeout: {timeout}s")
    
    return {
        'workers': workers,
        'bind': bind,
        'max_requests': max_requests,
        'max_requests_jitter': max_requests_jitter,
        'timeout': timeout,
        'keepalive': keepalive,
        'access_log': access_log,
        'error_log': error_log
    }

# Graceful shutdown handling
def on_starting(server):
    """Called just before the master process is initialized."""
    logger.info("🚀 Starting Flask application with Gunicorn...")
    logger.info(f"📊 Environment: {os.environ.get('NODE_ENV', 'production')}")
    logger.info(f"⚙️  Workers: {server.cfg.workers}")

def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    logger.info("♻️  Reloading Flask application...")

def worker_int(worker):
    """Called just after a worker has been terminated by SIGINT or SIGQUIT."""
    logger.info(f"🔄 Worker {worker.pid} received SIGINT/SIGQUIT")

def on_exit(server):
    """Called just before exiting Gunicorn."""
    logger.info("📴 Shutting down Flask application...")

# Health check for Gunicorn
def when_ready(server):
    """Called just after the server is started."""
    logger.info(f"✅ Flask application ready! Listening on {server.cfg.bind}")

# Production configuration validation
def validate_production_config():
    """Validate production environment configuration"""
    required_env_vars = [
        'NODE_ENV',
        'USE_EXPRESS'
    ]
    
    missing_vars = []
    for var in required_env_vars:
        if not os.environ.get(var):
            missing_vars.append(var)
    
    if missing_vars:
        logger.warning(f"Missing environment variables: {', '.join(missing_vars)}")
    
    # Check if logs directory exists
    if not os.path.exists('logs'):
        logger.warning("Logs directory not found. Creating...")
        try:
            os.makedirs('logs', exist_ok=True)
            logger.info("Created logs directory")
        except Exception as e:
            logger.error(f"Failed to create logs directory: {e}")

# Initialize production configuration
if __name__ != '__main__':
    # Running under WSGI server
    validate_production_config()
    
    logger.info("🔧 Flask application loaded via WSGI")
    logger.info(f"📊 Environment: {os.environ.get('NODE_ENV', 'production')}")
    logger.info(f"⚙️  Mode: {os.environ.get('USE_EXPRESS', 'true')}")

# For direct execution (development only)
if __name__ == '__main__':
    logger.warning("⚠️  Direct execution detected. Use Gunicorn for production!")
    application.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=os.environ.get('NODE_ENV') == 'development'
    )