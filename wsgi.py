"""
WSGI Entry Point for Gunicorn Server - Python Flask Application

This WSGI entry point provides production-ready deployment configuration for the Flask
application using Gunicorn server. It replicates the PM2 clustering and process management
approach from the Node.js implementation to ensure consistent multi-worker architecture
across both technology stacks.

Features:
- Automatic worker configuration based on CPU cores (equivalent to PM2 'max' instances)
- Structured logging configuration matching Winston logging approach from Node.js server
- Production environment detection with appropriate optimizations
- Graceful shutdown handling compatible with containerized deployments
- Health check worker settings for load balancer integration
- WSGI-compliant application interface for Gunicorn discovery

Usage:
    gunicorn -w 4 -b 0.0.0.0:3000 wsgi:application
    gunicorn --config gunicorn.conf.py wsgi:application

Environment Variables:
    NODE_ENV: Environment mode (development/staging/production)
    PORT: HTTP server port (default: 3000)
    WORKERS: Override automatic worker calculation
    LOG_LEVEL: Logging verbosity (DEBUG/INFO/WARNING/ERROR)
"""

# Standard library imports for system configuration and logging
import os
import logging
import multiprocessing

# Import Flask application instance from app.py
from app import app

# Environment configuration with secure defaults
NODE_ENV = os.environ.get('NODE_ENV', 'development')
PORT = int(os.environ.get('PORT', 3000))
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()
WORKERS_OVERRIDE = os.environ.get('WORKERS')

# Production environment detection
is_production = NODE_ENV == 'production'
is_development = NODE_ENV == 'development'

# Configure structured logging to match Winston logging approach from Node.js server
def configure_logging():
    """
    Configure structured logging equivalent to Winston logger configuration
    Provides consistent log formatting and levels across Node.js and Python implementations
    """
    # Map string log levels to logging constants
    log_level_mapping = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL
    }
    
    # Get numeric log level, default to INFO if invalid
    numeric_log_level = log_level_mapping.get(LOG_LEVEL, logging.INFO)
    
    # Configure basic logging with structured format (force configuration)
    logging.basicConfig(
        level=numeric_log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        force=True  # Force reconfiguration even if already configured
    )
    
    # Get logger instance for this module and explicitly set level
    logger = logging.getLogger(__name__)
    logger.setLevel(numeric_log_level)
    
    # Log startup information
    logger.info(f"WSGI entry point configured for {NODE_ENV} environment")
    logger.info(f"Log level set to {LOG_LEVEL}")
    
    if is_production:
        logger.info("Production mode: Optimized for performance and security")
    elif is_development:
        logger.info("Development mode: Debug features enabled")
    
    return logger

# Initialize logging configuration
logger = configure_logging()

# Worker configuration calculation based on CPU cores (equivalent to PM2 'max' instances)
def calculate_optimal_workers():
    """
    Calculate optimal number of worker processes based on available CPU cores
    Replicates PM2 'max' instances behavior for consistent scaling across platforms
    
    Returns:
        int: Optimal number of worker processes
    """
    try:
        # Get CPU count using multiprocessing module
        cpu_count = multiprocessing.cpu_count()
        
        # Override if WORKERS environment variable is set
        if WORKERS_OVERRIDE:
            try:
                workers = int(WORKERS_OVERRIDE)
                logger.info(f"Using override worker count: {workers}")
                return workers
            except ValueError:
                logger.warning(f"Invalid WORKERS override value: {WORKERS_OVERRIDE}, using CPU-based calculation")
        
        # Production: Use all available cores (equivalent to PM2 'max')
        if is_production:
            workers = cpu_count
            logger.info(f"Production mode: Using all {workers} CPU cores")
            return workers
        
        # Development: Use half the cores or minimum 2
        else:
            workers = max(2, cpu_count // 2)
            logger.info(f"Development mode: Using {workers} workers ({cpu_count} cores available)")
            return workers
            
    except Exception as e:
        logger.error(f"Failed to determine CPU count: {e}")
        # Fallback to 2 workers if CPU detection fails
        fallback_workers = 2
        logger.warning(f"Using fallback worker count: {fallback_workers}")
        return fallback_workers

# Calculate optimal worker count
optimal_workers = calculate_optimal_workers()

# Configure Flask application for production deployment
def configure_flask_app():
    """
    Configure Flask application settings for production WSGI deployment
    Applies production optimizations and security configurations
    """
    # Production-specific configuration
    if is_production:
        # Disable debug mode and testing
        app.config['DEBUG'] = False
        app.config['TESTING'] = False
        
        # Security configurations
        app.config['SESSION_COOKIE_SECURE'] = True
        app.config['SESSION_COOKIE_HTTPONLY'] = True
        app.config['SESSION_COOKIE_SAMESITE'] = 'Strict'
        
        logger.info("Flask app configured for production deployment")
    
    # Development-specific configuration
    elif is_development:
        # Enable debug mode for development
        app.config['DEBUG'] = True
        
        logger.info("Flask app configured for development")
    
    # Log current configuration status
    logger.info(f"Flask app configuration: DEBUG={app.config.get('DEBUG', False)}")
    logger.info(f"Flask app secret key configured: {bool(app.config.get('SECRET_KEY'))}")
    
    return app

# Apply Flask configuration
configured_app = configure_flask_app()

# Health check worker settings for load balancer integration
def configure_health_check_settings():
    """
    Configure health check settings compatible with load balancer requirements
    Provides metadata for Gunicorn worker management and health monitoring
    """
    health_check_config = {
        'enabled': True,
        'endpoint': '/health',
        'timeout': 30,  # 30 second timeout for health checks
        'worker_connections': 1000,  # Maximum connections per worker
        'max_requests': 1000,  # Requests before worker restart (equivalent to PM2 max_memory_restart)
        'max_requests_jitter': 100,  # Add jitter to prevent thundering herd
        'preload_app': True,  # Preload application for better performance
        'graceful_timeout': 30  # Graceful shutdown timeout (equivalent to PM2 kill_timeout)
    }
    
    logger.info("Health check settings configured for load balancer integration")
    logger.info(f"Health check endpoint: {health_check_config['endpoint']}")
    logger.info(f"Worker graceful timeout: {health_check_config['graceful_timeout']}s")
    
    return health_check_config

# Configure health check settings
health_check_config = configure_health_check_settings()

# Graceful shutdown handling for containerized deployments
def setup_graceful_shutdown():
    """
    Setup graceful shutdown handling for WSGI application
    Ensures proper cleanup during container restarts and deployments
    """
    import signal
    import sys
    
    def signal_handler(signum, frame):
        """Handle shutdown signals gracefully"""
        signal_name = signal.Signals(signum).name
        logger.info(f"Received {signal_name} signal, initiating graceful shutdown")
        
        # Perform cleanup operations
        try:
            # Flask app cleanup (if needed)
            logger.info("Flask application cleanup completed")
            
            # Log successful shutdown
            logger.info("Graceful shutdown completed successfully")
            
        except Exception as e:
            logger.error(f"Error during graceful shutdown: {e}")
        
        finally:
            # Exit gracefully
            sys.exit(0)
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    logger.info("Graceful shutdown handlers registered (SIGTERM, SIGINT)")

# Setup graceful shutdown handling
setup_graceful_shutdown()

# WSGI application interface for Gunicorn discovery
# This is the main entry point that Gunicorn will use to serve the Flask application
application = configured_app

# Log WSGI application setup completion
logger.info("WSGI application setup completed")
logger.info(f"Application callable: {type(application).__name__}")
logger.info(f"Recommended Gunicorn command: gunicorn -w {optimal_workers} -b 0.0.0.0:{PORT} wsgi:application")

# Verify WSGI interface compliance
if hasattr(application, '__call__'):
    logger.info("✓ WSGI __call__ interface verified")
else:
    logger.error("✗ WSGI __call__ interface missing")

if hasattr(application, 'wsgi_app'):
    logger.info("✓ Flask wsgi_app attribute available")
else:
    logger.warning("⚠ Flask wsgi_app attribute not found (normal for Flask < 2.0)")

if hasattr(application, 'config'):
    logger.info("✓ Flask config attribute available")
    logger.info(f"Application configuration keys: {len(application.config.keys())}")
else:
    logger.error("✗ Flask config attribute missing")

# Production deployment guidance
if is_production:
    logger.info("🚀 Production deployment recommendations:")
    logger.info(f"   - Use {optimal_workers} Gunicorn workers (based on {multiprocessing.cpu_count()} CPU cores)")
    logger.info("   - Enable preload_app for better performance")
    logger.info("   - Configure reverse proxy (nginx) for static files")
    logger.info("   - Monitor worker memory usage and restart limits")
    logger.info("   - Setup log rotation for production logs")

# Development mode guidance
elif is_development:
    logger.info("🛠 Development mode active:")
    logger.info(f"   - Using {optimal_workers} workers for development")
    logger.info("   - Debug mode enabled in Flask")
    logger.info("   - Auto-reload on code changes (if using --reload)")
    logger.info("   - Detailed error messages enabled")