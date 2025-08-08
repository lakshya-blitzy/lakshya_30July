"""
Python Flask Implementation - Feature Parity with Node.js Server

This Flask application mirrors the Node.js server functionality:
- /hello endpoint returning "Hello world" 
- /good-evening endpoint returning "Good evening"
- Health check and monitoring endpoints
- Equivalent security middleware using Flask extensions
- Rate limiting and CORS policies matching Node.js implementation
"""

import os
import time
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask application
app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('JWT_SECRET', 'dev-secret-key-change-in-production')
USE_EXPRESS_EQUIVALENT = os.environ.get('USE_EXPRESS', 'true').lower() == 'true'
NODE_ENV = os.environ.get('NODE_ENV', 'development')

# Security headers configuration (equivalent to Helmet.js)
if USE_EXPRESS_EQUIVALENT:
    csp = {
        'default-src': "'self'",
        'style-src': ["'self'", "'unsafe-inline'"],
        'script-src': "'self'",
        'img-src': ["'self'", "data:", "https:"],
        'connect-src': "'self'",
        'font-src': "'self'",
        'object-src': "'none'",
        'media-src': "'self'",
        'frame-src': "'none'",
    }
    
    # Use basic Talisman configuration - some parameter names vary by version
    Talisman(app, 
        force_https=NODE_ENV == 'production',
        strict_transport_security=True,
        content_security_policy=csp,
        frame_options='DENY',
        referrer_policy='no-referrer'
    )

# CORS configuration (equivalent to Express CORS)
if USE_EXPRESS_EQUIVALENT:
    cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
    if NODE_ENV == 'development':
        cors_origins = '*'  # Allow all origins in development
    
    CORS(app, 
        origins=cors_origins,
        methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
        supports_credentials=True
    )

# Rate limiting configuration (equivalent to express-rate-limit)
if USE_EXPRESS_EQUIVALENT:
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["1000 per hour"],  # Global limit
        storage_uri="memory://"
    )
    limiter.init_app(app)
else:
    # Placeholder for basic mode
    limiter = None

# Store app start time for uptime calculation
app_start_time = time.time()

# Routes

@app.route('/hello', methods=['GET'])
def hello():
    """
    Hello endpoint - returns "Hello world" in plain text
    Available in both basic and Express-equivalent modes
    """
    response = make_response('Hello world')
    response.headers['Content-Type'] = 'text/plain'
    return response

if USE_EXPRESS_EQUIVALENT:
    @app.route('/good-evening', methods=['GET'])
    def good_evening():
        """
        Good evening endpoint - returns "Good evening" in plain text
        Only available in Express-equivalent mode
        """
        response = make_response('Good evening')
        response.headers['Content-Type'] = 'text/plain'
        return response

@app.route('/health', methods=['GET'])
def health():
    """
    Health check endpoint - returns system status
    """
    uptime = time.time() - app_start_time
    
    return jsonify({
        'status': 'healthy',
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime()),
        'environment': NODE_ENV,
        'uptime': uptime,
        'mode': 'flask-express-equivalent' if USE_EXPRESS_EQUIVALENT else 'flask-basic'
    })

@app.route('/ping', methods=['GET'])
def ping():
    """
    Ping endpoint for basic connectivity checks
    """
    return jsonify({'message': 'pong'})

if USE_EXPRESS_EQUIVALENT:
    @app.route('/api/status', methods=['GET'])
    @limiter.limit("100 per minute")  # API-specific rate limit
    def api_status():
        """
        API status endpoint with rate limiting
        Only available in Express-equivalent mode
        """
        return jsonify({
            'status': 'operational',
            'version': '1.0.0',
            'security': {
                'talisman': 'enabled',
                'cors': 'enabled',
                'rateLimit': 'enabled',
                'inputValidation': 'enabled',
                'https': 'available' if NODE_ENV == 'production' else 'development'
            }
        })
    
    @app.route('/api/data', methods=['POST'])
    @limiter.limit("100 per minute")  # API-specific rate limit
    def api_data():
        """
        Example API endpoint with input validation
        Only available in Express-equivalent mode
        """
        if not request.json or 'data' not in request.json:
            return jsonify({
                'error': 'Invalid input data',
                'details': [{'field': 'data', 'message': 'data is required'}]
            }), 400
        
        data = request.json['data']
        
        # Basic validation
        if not data or len(str(data)) > 1000:
            return jsonify({
                'error': 'Invalid input data',
                'details': [{'field': 'data', 'message': 'data must be between 1 and 1000 characters'}]
            }), 400
        
        return jsonify({
            'message': 'Data processed successfully',
            'received': data,
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
        })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'error': 'Not found',
        'message': 'The requested resource was not found',
        'path': request.path
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        'error': 'Internal server error',
        'message': 'An error occurred while processing your request' if NODE_ENV == 'production' else str(error)
    }), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    """Handle rate limit exceeded errors"""
    return jsonify({
        'error': 'Rate limit exceeded',
        'message': 'Too many requests. Please try again later.',
        'retryAfter': 60
    }), 429

# Request logging middleware
@app.before_request
def log_request_info():
    """Log request information for monitoring"""
    if NODE_ENV == 'development':
        print(f"Request: {request.method} {request.path} from {request.remote_addr}")

@app.after_request
def after_request(response):
    """Add security headers to all responses"""
    if not USE_EXPRESS_EQUIVALENT:
        # Add basic security headers for basic mode
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
    
    return response

if __name__ == '__main__':
    # Direct execution for development
    port = int(os.environ.get('PORT', 5000))
    debug = NODE_ENV == 'development'
    
    print(f"🚀 Flask Server starting on port {port}")
    print(f"📊 Environment: {NODE_ENV}")
    print(f"⚙️  Mode: {'Flask with security features' if USE_EXPRESS_EQUIVALENT else 'Basic Flask server'}")
    
    if USE_EXPRESS_EQUIVALENT:
        print(f"🛡️  Security features enabled:")
        print(f"   - Talisman security headers")
        print(f"   - CORS with origin validation")
        print(f"   - Rate limiting (1000 req/hour global, 100 req/min API)")
        print(f"   - Input validation")
        print(f"📡 Available endpoints:")
        print(f"   - GET /hello - Hello world endpoint")
        print(f"   - GET /good-evening - Good evening endpoint")
        print(f"   - GET /health - Health check")
        print(f"   - GET /ping - Ping endpoint")
        print(f"   - POST /api/data - Data processing with validation")
        print(f"   - GET /api/status - API status")
    else:
        print(f"📡 Available endpoints:")
        print(f"   - GET /hello - Hello world endpoint")
        print(f"   - GET /health - Health check")
        print(f"   - GET /ping - Ping endpoint")
        print(f"💡 To enable full features: set USE_EXPRESS=true")
    
    app.run(host='0.0.0.0', port=port, debug=debug)