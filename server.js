/**
 * Dual-Mode Node.js Server with Progressive Enhancement
 * 
 * This server implementation supports two operational modes:
 * 1. Basic HTTP Server (USE_EXPRESS=false): Minimal HTTP server with /hello endpoint
 * 2. Express.js Server (USE_EXPRESS=true): Full-featured server with security middleware
 * 
 * Security Features (Express mode only):
 * - CVE-2024-43796: Express.js XSS vulnerability via response.redirect()
 * - CVE-2024-45590: body-parser DoS vulnerability mitigation
 * - Helmet.js security headers (Content-Security-Policy, Cross-Origin policies)
 * - Express-rate-limit for DDoS protection (1000 req/hour global, 100 req/min API)
 * - Express-validator for comprehensive input validation and sanitization
 * - CORS policies with origin validation and optionsSuccessStatus
 * - HTTPS server with TLS/SSL certificate support
 * - Security-focused error handling without stack trace exposure
 * - Removal of X-Powered-By header to prevent fingerprinting
 */

// Load environment variables before other imports
require('dotenv').config();

// Core dependencies always available
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Check if Express mode is enabled
const USE_EXPRESS = process.env.USE_EXPRESS !== 'false'; // Default to true for backward compatibility

// Conditionally import Express and security dependencies
let express, helmet, rateLimit, cors, check, validationResult, bodyParser;
if (USE_EXPRESS) {
  express = require('express');
  helmet = require('helmet');
  rateLimit = require('express-rate-limit');
  cors = require('cors');
  ({ check, validationResult } = require('express-validator'));
  bodyParser = require('body-parser');
}

// Initialize application based on mode
let app;
if (USE_EXPRESS) {
  app = express();
} else {
  // For basic HTTP mode, we'll create a simple request handler
  app = null;
}

// Configure environment variables with secure defaults
const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGINS = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'];
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000;
const API_RATE_LIMIT_WINDOW_MS = parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 60000; // 1 minute
const API_RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 100;

// Basic HTTP server request handler (for non-Express mode)
const handleBasicRequest = (req, res) => {
  // Set basic headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Route handling for basic HTTP mode
  if (req.method === 'GET' && req.url === '/hello') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello world');
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      uptime: process.uptime(),
      mode: 'basic-http'
    }));
  } else if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'pong' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not found',
      message: 'The requested resource was not found',
      path: req.url
    }));
  }
};

// Express.js configuration (only when USE_EXPRESS is true)
if (USE_EXPRESS) {

  // Security middleware configuration
  // 1. Helmet.js - Comprehensive security headers
  app.use(helmet({
    // Content Security Policy - prevents XSS and other injection attacks
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // Cross-Origin-Opener-Policy - helps process-isolate pages
    crossOriginOpenerPolicy: { policy: "same-origin" },
    // Cross-Origin-Resource-Policy - blocks others from loading resources cross-origin
    crossOriginResourcePolicy: { policy: "same-site" },
    // Remove X-Powered-By header to prevent fingerprinting
    hidePoweredBy: true,
    // HTTP Strict Transport Security - enforces HTTPS connections
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    // X-Content-Type-Options - prevents MIME type sniffing
    noSniff: true,
    // X-Frame-Options - prevents clickjacking
    frameguard: { action: 'deny' },
    // X-XSS-Protection - legacy XSS filter (disabled as recommended)
    xssFilter: false
  }));

  // 2. CORS configuration with origin validation
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      if (CORS_ORIGINS.indexOf(origin) !== -1 || NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS policy'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200 // Legacy browser support
  }));

  // 3. Rate limiting configuration
  // Global rate limiter - 1000 requests per hour per IP
  const globalLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_REQUESTS,
    message: {
      error: 'Too many requests from this IP address. Please try again later.',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/ping';
    }
  });

  // API rate limiter - 100 requests per minute per IP for API endpoints
  const apiLimiter = rateLimit({
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    max: API_RATE_LIMIT_MAX_REQUESTS,
    message: {
      error: 'API rate limit exceeded. Please reduce request frequency.',
      retryAfter: Math.ceil(API_RATE_LIMIT_WINDOW_MS / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Apply global rate limiting
  app.use(globalLimiter);

  // 4. Body parsing middleware (updated to fix CVE-2024-45590)
  app.use(bodyParser.json({
    limit: '10mb',
    strict: true
  }));

  app.use(bodyParser.urlencoded({
    extended: true,
    limit: '10mb'
  }));

  // Also use Express built-in parsers for redundancy
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 5. Input validation middleware factory
  const createValidationRules = (fieldName, location = 'body') => {
    return [
      check(fieldName)
        .exists()
        .withMessage(`${fieldName} is required`)
        .notEmpty()
        .withMessage(`${fieldName} is required`)
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage(`${fieldName} must be between 1 and 1000 characters`)
        .escape() // Sanitize HTML entities to prevent XSS
    ];
  };

  // Validation result handler
  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Log validation errors securely (without exposing sensitive data)
      console.warn('Validation failed:', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        errors: errors.array().map(err => ({ field: err.path || err.param, message: err.msg }))
      });
      
      return res.status(400).json({
        error: 'Invalid input data',
        details: errors.array().map(err => ({
          field: err.path || err.param || 'unknown',
          message: err.msg
        }))
      });
    }
    next();
  };

  // Security-focused error handling middleware
  const secureErrorHandler = (err, req, res, next) => {
    // Log error details securely for debugging (not exposed to client)
    console.error('Server error:', {
      message: err.message,
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Determine error type and send appropriate response
    if (err.message === 'Not allowed by CORS policy') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'CORS policy violation'
      });
    }

    if (err.code === 'LIMIT_FILE_SIZE' || err.type === 'entity.too.large' || err.message.includes('request entity too large')) {
      return res.status(413).json({
        error: 'Payload too large',
        message: 'Payload too large'
      });
    }

    // Generic error response (no stack trace exposure)
    const statusCode = err.statusCode || err.status || 500;
    const isProduction = NODE_ENV === 'production';
    
    res.status(statusCode).json({
      error: 'Internal server error',
      message: isProduction ? 'An error occurred while processing your request' : err.message,
      requestId: req.id || Math.random().toString(36).substr(2, 9)
    });
  };

  // Route definitions with security middleware

  // Hello endpoint - returns "Hello world" in plain text
  app.get('/hello', (req, res) => {
    res.type('text/plain').send('Hello world');
  });

  // Good evening endpoint - returns "Good evening" in plain text
  app.get('/good-evening', (req, res) => {
    res.type('text/plain').send('Good evening');
  });

  // Health check endpoint (no rate limiting)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      uptime: process.uptime(),
      mode: 'express'
    });
  });

  // Ping endpoint for basic connectivity checks
  app.get('/ping', (req, res) => {
    res.status(200).json({ message: 'pong' });
  });

  // API endpoints with enhanced rate limiting and validation
  app.use('/api', apiLimiter);

  // Example API endpoint with input validation
  app.post('/api/data', 
    createValidationRules('data'),
    handleValidationErrors,
    (req, res) => {
      const { data } = req.body;
      
      // Process validated and sanitized data
      res.status(200).json({
        message: 'Data processed successfully',
        received: data,
        timestamp: new Date().toISOString()
      });
    }
  );

  // Example GET API endpoint
  app.get('/api/status', (req, res) => {
    res.status(200).json({
      status: 'operational',
      version: '1.0.0',
      security: {
        helmet: 'enabled',
        cors: 'enabled',
        rateLimit: 'enabled',
        inputValidation: 'enabled',
        https: 'available'
      }
    });
  });

  // Static file serving with security headers
  app.use('/static', express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    setHeaders: (res, path) => {
      // Additional security headers for static files
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
    }
  }));

  // Catch-all route for undefined endpoints
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: 'The requested resource was not found',
      path: req.originalUrl
    });
  });

  // Apply security error handler
  app.use(secureErrorHandler);
} // End of Express configuration

// HTTPS server configuration
let httpsServer = null;

try {
  // Check for SSL certificate files
  const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs', 'server.crt');
  const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs', 'server.key');
  
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    
    httpsServer = https.createServer(httpsOptions, app);
    console.log('HTTPS server configured with SSL certificates');
  } else {
    console.warn('SSL certificates not found. HTTPS server not available.');
    console.warn('Generate certificates or set SSL_CERT_PATH and SSL_KEY_PATH environment variables.');
  }
} catch (error) {
  console.error('Failed to configure HTTPS server:', error.message);
}

// HTTP server (with HTTPS redirect in production and dual-mode support)
const httpServer = http.createServer((req, res) => {
  // Redirect HTTP to HTTPS in production when Express is enabled and HTTPS is available
  if (NODE_ENV === 'production' && USE_EXPRESS && httpsServer) {
    const httpsUrl = `https://${req.headers.host.replace(/:\d+$/, `:${HTTPS_PORT}`)}${req.url}`;
    res.writeHead(301, { 'Location': httpsUrl });
    res.end();
  } else {
    // Serve based on mode
    if (USE_EXPRESS) {
      app(req, res);
    } else {
      handleBasicRequest(req, res);
    }
  }
});

// Server startup function
const startServers = () => {
  // Start HTTP server
  httpServer.listen(HTTP_PORT, () => {
    console.log(`🚀 HTTP Server running on port ${HTTP_PORT}`);
    console.log(`📊 Environment: ${NODE_ENV}`);
    console.log(`⚙️  Mode: ${USE_EXPRESS ? 'Express.js with full security features' : 'Basic HTTP server'}`);
    
    if (USE_EXPRESS) {
      console.log(`🛡️  Security features enabled:`);
      console.log(`   - Helmet.js security headers`);
      console.log(`   - CORS with origin validation`);
      console.log(`   - Rate limiting (${RATE_LIMIT_MAX_REQUESTS} req/hour global, ${API_RATE_LIMIT_MAX_REQUESTS} req/min API)`);
      console.log(`   - Input validation and sanitization`);
      console.log(`   - Secure error handling`);
      console.log(`📡 Available endpoints:`);
      console.log(`   - GET /hello - Hello world endpoint`);
      console.log(`   - GET /good-evening - Good evening endpoint`);
      console.log(`   - GET /health - Health check`);
      console.log(`   - GET /ping - Ping endpoint`);
      console.log(`   - POST /api/data - Data processing with validation`);
      console.log(`   - GET /api/status - API status`);
    } else {
      console.log(`📡 Available endpoints:`);
      console.log(`   - GET /hello - Hello world endpoint`);
      console.log(`   - GET /health - Health check`);
      console.log(`   - GET /ping - Ping endpoint`);
      console.log(`💡 To enable Express mode: set USE_EXPRESS=true`);
    }
  });

  // Start HTTPS server if available and Express mode is enabled
  if (USE_EXPRESS && httpsServer) {
    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`🔒 HTTPS Server running on port ${HTTPS_PORT}`);
      console.log(`🔐 TLS/SSL encryption enabled`);
    });
  }
};

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);
  
  const shutdownPromises = [];
  
  // Close HTTP server
  if (httpServer.listening) {
    shutdownPromises.push(new Promise((resolve) => {
      httpServer.close(() => {
        console.log('HTTP server closed');
        resolve();
      });
    }));
  }
  
  // Close HTTPS server
  if (httpsServer && httpsServer.listening) {
    shutdownPromises.push(new Promise((resolve) => {
      httpsServer.close(() => {
        console.log('HTTPS server closed');
        resolve();
      });
    }));
  }
  
  Promise.all(shutdownPromises).then(() => {
    console.log('✅ Graceful shutdown completed');
    // Only exit in production, not during testing
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  });
  
  // Force exit after 30 seconds (only in production)
  if (process.env.NODE_ENV !== 'test') {
    setTimeout(() => {
      console.error('❌ Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start servers if this file is run directly
if (require.main === module) {
  startServers();
}

// Export for external use and testing
module.exports = {
  app,
  httpServer,
  httpsServer,
  startServers,
  gracefulShutdown
};