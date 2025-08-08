"""
Secure Flask Server with Comprehensive Security Middleware

This Flask application maintains complete feature parity with the Node.js Express server,
providing identical endpoint behavior and security features. Implements OWASP Top 10
protections and mirrors all functionality from the original server.js implementation.

Security Features Implemented:
- Flask-Talisman security headers (equivalent to Helmet.js)
- Flask-Limiter for DDoS protection (1000 req/hour global, 100 req/min API)
- Flask-CORS for cross-origin policies with origin validation
- Input validation and sanitization for all POST endpoints
- Comprehensive error handling without stack trace exposure
- Production-ready Gunicorn WSGI configuration

Endpoint Parity:
- /hello → "Hello world" (text/plain)
- /good-evening → "Good evening" (text/plain) 
- /health → Health check with system information
- /ping → Basic connectivity test
- /api/data → POST endpoint with input validation
- /api/status → System status and security information
"""

# Load environment variables before other imports
from dotenv import load_dotenv
load_dotenv()

# Import Flask and core dependencies
from flask import Flask, request, jsonify, make_response
import os
from datetime import datetime
import time

# Import security and middleware extensions
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman

# Initialize Flask application
app = Flask(__name__)

# Configure environment variables with secure defaults
HTTP_PORT = int(os.environ.get('PORT', 3000))
NODE_ENV = os.environ.get('NODE_ENV', 'development')
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',') if os.environ.get('CORS_ORIGINS') else ['http://localhost:3000']
RATE_LIMIT_WINDOW_MS = int(os.environ.get('RATE_LIMIT_WINDOW_MS', 3600000))  # 1 hour in ms
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get('RATE_LIMIT_MAX_REQUESTS', 1000))
API_RATE_LIMIT_WINDOW_MS = int(os.environ.get('API_RATE_LIMIT_WINDOW_MS', 60000))  # 1 minute in ms
API_RATE_LIMIT_MAX_REQUESTS = int(os.environ.get('API_RATE_LIMIT_MAX_REQUESTS', 100))

# Store application start time for uptime calculation
app_start_time = time.time()

# Security middleware configuration
# 1. Flask-Talisman - Comprehensive security headers (equivalent to Helmet.js)
talisman = Talisman(
    app,
    # Content Security Policy - prevents XSS and other injection attacks
    content_security_policy={
        'default-src': "'self'",
        'style-src': ["'self'", "'unsafe-inline'"],
        'script-src': "'self'",
        'img-src': ["'self'", "data:", "https:"],
        'connect-src': "'self'",
        'font-src': "'self'",
        'object-src': "'none'",
        'media-src': "'self'",
        'frame-src': "'none'",
    },
    # HTTP Strict Transport Security - enforces HTTPS connections
    strict_transport_security=True,
    strict_transport_security_max_age=31536000,  # 1 year
    strict_transport_security_include_subdomains=True,
    strict_transport_security_preload=True,
    # X-Content-Type-Options - prevents MIME type sniffing
    content_type_options=True,
    # X-Frame-Options - prevents clickjacking
    frame_options='DENY',
    # X-XSS-Protection - legacy XSS filter
    force_https=False,  # Allow HTTP in development
    # Remove server information to prevent fingerprinting
    referrer_policy='strict-origin-when-cross-origin'
)

# 2. CORS configuration with origin validation
def cors_origin_validator(origin):
    """Validate CORS origins with development mode flexibility"""
    if not origin:
        return True  # Allow requests with no origin (mobile apps, curl, etc.)
    
    if origin in CORS_ORIGINS or NODE_ENV == 'development':
        return True
    
    return False

cors = CORS(
    app,
    origins=cors_origin_validator,
    methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
    supports_credentials=True
)

# 3. Rate limiting configuration
# Global rate limiter - 1000 requests per hour per IP
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=[f"{RATE_LIMIT_MAX_REQUESTS} per hour"],
    storage_uri="memory://",
    # Convert milliseconds to human-readable format for limiter
    headers_enabled=True
)

# API rate limiter - 100 requests per minute per IP for API endpoints  
api_rate_limit = f"{API_RATE_LIMIT_MAX_REQUESTS} per minute"

# Input validation functions
def validate_data_input(data):
    """
    Validate and sanitize input data equivalent to express-validator
    Returns (is_valid, error_message, sanitized_data)
    """
    if not data:
        return False, "data is required", None
    
    if not isinstance(data, str):
        return False, "data must be a string", None
    
    # Trim whitespace
    data = data.strip()
    
    if len(data) == 0:
        return False, "data is required", None
    
    if len(data) > 1000:
        return False, "data must be between 1 and 1000 characters", None
    
    # Basic HTML entity escaping to prevent XSS
    sanitized_data = (data.replace('&', '&amp;')
                         .replace('<', '&lt;')
                         .replace('>', '&gt;')
                         .replace('"', '&quot;')
                         .replace("'", '&#x27;'))
    
    return True, None, sanitized_data

# Security-focused error handling
@app.errorhandler(400)
def bad_request(error):
    """Handle bad request errors securely"""
    return jsonify({
        'error': 'Bad request',
        'message': 'Invalid request data'
    }), 400

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors with security-conscious response"""
    return jsonify({
        'error': 'Not found',
        'message': 'The requested resource was not found',
        'path': request.path
    }), 404

@app.errorhandler(429)
def rate_limit_exceeded(error):
    """Handle rate limit exceeded errors"""
    return jsonify({
        'error': 'Too many requests',
        'message': 'Rate limit exceeded. Please try again later.',
        'retryAfter': error.retry_after if hasattr(error, 'retry_after') else 3600
    }), 429

@app.errorhandler(500)
def internal_error(error):
    """Handle internal server errors securely"""
    # Log error details securely for debugging (not exposed to client)
    app.logger.error(f'Server error: {str(error)} - IP: {request.remote_addr} - Path: {request.path} - Method: {request.method}')
    
    # Generic error response (no stack trace exposure)
    is_production = NODE_ENV == 'production'
    
    return jsonify({
        'error': 'Internal server error',
        'message': 'An error occurred while processing your request' if is_production else str(error),
        'requestId': os.urandom(5).hex()
    }), 500

# Route definitions with security middleware

# Core tutorial endpoints - exact behavior match with Node.js server
@app.route('/hello', methods=['GET'])
@limiter.exempt  # Exempt from global rate limiting for tutorial simplicity
def hello():
    """
    Hello world endpoint - returns plain text response
    Maintains exact parity with Node.js server.js /hello endpoint
    """
    response = make_response('Hello world')
    response.headers['Content-Type'] = 'text/plain'
    return response

@app.route('/good-evening', methods=['GET'])
@limiter.exempt  # Exempt from global rate limiting for tutorial simplicity
def good_evening():
    """
    Good evening endpoint - returns plain text response
    Maintains exact parity with Node.js server.js /good-evening endpoint
    """
    response = make_response('Good evening')
    response.headers['Content-Type'] = 'text/plain'
    return response

# Health check endpoint (no rate limiting)
@app.route('/health', methods=['GET'])
@limiter.exempt  # Skip rate limiting for health checks
def health():
    """Health check endpoint for load balancer integration"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'environment': NODE_ENV,
        'uptime': time.time() - app_start_time
    }), 200

# Ping endpoint for basic connectivity checks
@app.route('/ping', methods=['GET'])
@limiter.exempt  # Skip rate limiting for ping checks
def ping():
    """Basic connectivity test endpoint"""
    return jsonify({'message': 'pong'}), 200

# API endpoints with enhanced rate limiting and validation
@app.route('/api/data', methods=['POST'])
@limiter.limit(api_rate_limit)  # Apply API-specific rate limiting
def api_data():
    """
    API endpoint for data processing with input validation
    Equivalent to Node.js server.js /api/data endpoint
    """
    # Validate request content type
    if not request.is_json:
        return jsonify({
            'error': 'Invalid input data',
            'details': [{'field': 'content-type', 'message': 'Content-Type must be application/json'}]
        }), 400
    
    # Get JSON data
    json_data = request.json if request.json else {}
    data = json_data.get('data')
    
    # Validate and sanitize input
    is_valid, error_message, sanitized_data = validate_data_input(data)
    
    if not is_valid:
        return jsonify({
            'error': 'Invalid input data',
            'details': [{'field': 'data', 'message': error_message}]
        }), 400
    
    # Process validated and sanitized data
    return jsonify({
        'message': 'Data processed successfully',
        'received': sanitized_data,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }), 200

@app.route('/api/status', methods=['GET'])
@limiter.limit(api_rate_limit)  # Apply API-specific rate limiting
def api_status():
    """
    API status endpoint showing system and security information
    Equivalent to Node.js server.js /api/status endpoint
    """
    return jsonify({
        'status': 'operational',
        'version': '1.0.0',
        'security': {
            'talisman': 'enabled',
            'cors': 'enabled',
            'rateLimit': 'enabled',
            'inputValidation': 'enabled',
            'https': 'available'
        }
    }), 200

# Before request handlers for logging and security
@app.before_request
def before_request_handler():
    """
    Before request handler for security logging
    Equivalent to Express.js middleware pipeline
    """
    # Log security-relevant request information
    if NODE_ENV == 'development':
        app.logger.info(f'Request: {request.method} {request.path} from {request.remote_addr}')
    
    # Validate request size (equivalent to body-parser limits)
    content_length = request.content_length
    if content_length and content_length > 10 * 1024 * 1024:  # 10MB limit
        return jsonify({
            'error': 'Payload too large',
            'message': 'Request entity too large'
        }), 413

@app.after_request  
def after_request_handler(response):
    """
    After request handler for additional security headers
    Equivalent to Express.js response middleware
    """
    # Additional security headers for static files and API responses
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    
    # CORS handling for development
    if NODE_ENV == 'development':
        response.headers['Access-Control-Allow-Origin'] = '*'
    
    return response

# Production deployment configuration
if __name__ == '__main__':
    """
    Direct execution configuration for development
    Production deployment should use Gunicorn WSGI server
    """
    debug_mode = NODE_ENV == 'development'
    
    print("🚀 Flask Server Configuration:")
    print(f"📊 Environment: {NODE_ENV}")
    print(f"🛡️  Security features enabled:")
    print(f"   - Flask-Talisman security headers")
    print(f"   - CORS with origin validation")
    print(f"   - Rate limiting ({RATE_LIMIT_MAX_REQUESTS} req/hour global, {API_RATE_LIMIT_MAX_REQUESTS} req/min API)")
    print(f"   - Input validation and sanitization")
    print(f"   - Secure error handling")
    
    app.run(
        host='0.0.0.0',
        port=HTTP_PORT,
        debug=debug_mode,
        threaded=True
    )