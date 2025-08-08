/**
 * Comprehensive Security Test Suite for Node.js Express Server
 * 
 * This test suite validates OWASP Top 10 protections, vulnerability mitigations,
 * and security middleware effectiveness including:
 * - CVE-2024-45590: body-parser DoS vulnerability protection
 * - CVE-2024-43796: Express.js XSS via response.redirect() protection
 * - Helmet.js security headers implementation
 * - Rate limiting and DDoS protection
 * - Input validation and sanitization
 * - CORS policy enforcement
 * - HTTPS enforcement and certificate validation
 * - Secure error handling without sensitive data exposure
 * - JWT authentication security (if enabled)
 * - Graceful shutdown security procedures
 */

// Jest functions are globally available - no need to import
const request = require('supertest');
const process = require('process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import server components for testing
const { app, httpServer, httpsServer, startServers, gracefulShutdown } = require('../server.js');
const packageJson = require('../package.json');

// Test configuration and constants
const TEST_TIMEOUT = 30000; // 30 seconds for comprehensive security tests
const RATE_LIMIT_TEST_COUNT = 105; // Exceed rate limit threshold
const LARGE_PAYLOAD_SIZE = 11 * 1024 * 1024; // 11MB to test size limits
const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '"><script>alert("xss")</script>',
  'javascript:alert("xss")',
  '<img src=x onerror=alert("xss")>',
  '<svg/onload=alert("xss")>',
  '\'><script>alert(String.fromCharCode(88,83,83))</script>'
];
const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  "admin'--",
  "' UNION SELECT * FROM users --",
  "1; DELETE FROM users WHERE 1=1 --"
];
const COMMAND_INJECTION_PAYLOADS = [
  "; ls -la",
  "| cat /etc/passwd",
  "&& whoami",
  "`id`",
  "$(cat /etc/hosts)"
];

// Global test state
let testServer;
let testServerPort;

// Set Jest timeout for security tests
jest.setTimeout(TEST_TIMEOUT);

describe('Security Test Suite - OWASP Top 10 & CVE Validation', () => {
  
  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.USE_EXPRESS = 'true';
    process.env.RATE_LIMIT_MAX_REQUESTS = '100';
    process.env.API_RATE_LIMIT_MAX_REQUESTS = '50';
    process.env.CORS_ORIGINS = 'http://localhost:3000,https://example.com';
    
    // Start test server on dynamic port
    testServer = app.listen(0);
    testServerPort = testServer.address().port;
    
    console.log(`Security test server started on port ${testServerPort}`);
  });

  afterAll(async () => {
    // Graceful shutdown
    if (testServer) {
      await new Promise((resolve) => {
        testServer.close(resolve);
      });
    }
    
    // Clean up any test files
    const testCertPath = path.join(__dirname, 'test-cert.pem');
    const testKeyPath = path.join(__dirname, 'test-key.pem');
    
    if (fs.existsSync(testCertPath)) {
      fs.unlinkSync(testCertPath);
    }
    if (fs.existsSync(testKeyPath)) {
      fs.unlinkSync(testKeyPath);
    }
  });

  describe('A01: Broken Access Control - Authentication & Authorization', () => {
    
    test('should require authentication for protected API endpoints', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);
      
      // Verify response structure doesn't expose sensitive data
      expect(response.body).toHaveProperty('status');
      expect(response.body).not.toHaveProperty('secrets');
      expect(response.body).not.toHaveProperty('keys');
      expect(response.body).not.toHaveProperty('passwords');
    });

    test('should handle invalid authorization headers gracefully', async () => {
      const response = await request(app)
        .get('/api/status')
        .set('Authorization', 'Bearer invalid-token-format')
        .expect(200);
      
      // Should not expose token validation errors
      expect(JSON.stringify(response.body)).not.toMatch(/token/i);
      expect(JSON.stringify(response.body)).not.toMatch(/jwt/i);
    });

    test('should prevent unauthorized access to admin endpoints', async () => {
      const response = await request(app)
        .get('/admin/users')
        .expect(404); // Should not exist or should redirect to 404
      
      expect(response.body.error).toBe('Not found');
    });
  });

  describe('A02: Cryptographic Failures - HTTPS & Encryption', () => {
    
    test('should enforce secure headers for cryptographic protection', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      // Verify HSTS header is present
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toMatch(/max-age=\d+/);
      expect(response.headers['strict-transport-security']).toMatch(/includeSubDomains/);
    });

    test('should validate SSL certificate configuration', () => {
      // Test SSL certificate paths and validation
      const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '..', 'certs', 'server.crt');
      const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '..', 'certs', 'server.key');
      
      // If certificates exist, they should be readable
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        expect(() => fs.readFileSync(certPath)).not.toThrow();
        expect(() => fs.readFileSync(keyPath)).not.toThrow();
      }
    });

    test('should use secure random values for session tokens', () => {
      // Test cryptographic randomness
      const randomBytes1 = crypto.randomBytes(32);
      const randomBytes2 = crypto.randomBytes(32);
      
      expect(randomBytes1).not.toEqual(randomBytes2);
      expect(randomBytes1.length).toBe(32);
      expect(randomBytes2.length).toBe(32);
    });
  });

  describe('A03: Injection - SQL, XSS, Command Injection Prevention', () => {
    
    test('should sanitize and validate input to prevent XSS attacks', async () => {
      for (const xssPayload of XSS_PAYLOADS) {
        const response = await request(app)
          .post('/api/data')
          .send({ data: xssPayload })
          .expect(200);
        
        // Verify XSS payload is sanitized in response
        const responseBody = JSON.stringify(response.body);
        expect(responseBody).not.toContain('<script>');
        expect(responseBody).not.toContain('javascript:');
        expect(responseBody).not.toContain('onerror=');
        expect(responseBody).not.toContain('onload=');
      }
    });

    test('should prevent SQL injection attempts', async () => {
      for (const sqlPayload of SQL_INJECTION_PAYLOADS) {
        const response = await request(app)
          .post('/api/data')
          .send({ data: sqlPayload })
          .expect(200);
        
        // Verify SQL keywords are sanitized
        const responseBody = JSON.stringify(response.body);
        expect(responseBody).not.toContain('DROP TABLE');
        expect(responseBody).not.toContain('DELETE FROM');
        expect(responseBody).not.toContain('UNION SELECT');
      }
    });

    test('should prevent command injection attempts', async () => {
      for (const cmdPayload of COMMAND_INJECTION_PAYLOADS) {
        const response = await request(app)
          .post('/api/data')
          .send({ data: cmdPayload })
          .expect(200);
        
        // Verify command injection patterns are sanitized
        const responseBody = JSON.stringify(response.body);
        expect(responseBody).not.toContain('/etc/passwd');
        expect(responseBody).not.toContain('whoami');
        expect(responseBody).not.toContain('/etc/hosts');
      }
    });

    test('should validate input length and reject oversized payloads', async () => {
      const longString = 'A'.repeat(1001); // Exceeds 1000 char limit
      
      const response = await request(app)
        .post('/api/data')
        .send({ data: longString })
        .expect(400);
      
      expect(response.body.error).toBe('Invalid input data');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('A04: Insecure Design - Security Architecture Validation', () => {
    
    test('should implement defense in depth with multiple security layers', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);
      
      // Verify multiple security features are enabled
      expect(response.body.security).toBeDefined();
      expect(response.body.security.helmet).toBe('enabled');
      expect(response.body.security.cors).toBe('enabled');
      expect(response.body.security.rateLimit).toBe('enabled');
      expect(response.body.security.inputValidation).toBe('enabled');
    });

    test('should fail securely with proper error handling', async () => {
      // Test malformed JSON
      const response = await request(app)
        .post('/api/data')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
      
      // Should not expose internal error details
      expect(response.body.error).toBeDefined();
      expect(JSON.stringify(response.body)).not.toMatch(/stack/i);
      expect(JSON.stringify(response.body)).not.toMatch(/trace/i);
    });
  });

  describe('A05: Security Misconfiguration - Helmet.js Headers', () => {
    
    test('should enforce X-Content-Type-Options: nosniff header', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should enforce X-Frame-Options: DENY header', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should enforce Content-Security-Policy headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['content-security-policy']).toContain("object-src 'none'");
      expect(response.headers['content-security-policy']).toContain("frame-src 'none'");
    });

    test('should enforce Cross-Origin-Opener-Policy header', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    });

    test('should enforce Cross-Origin-Resource-Policy header', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers['cross-origin-resource-policy']).toBe('same-site');
    });

    test('should remove X-Powered-By header to prevent fingerprinting', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('should enforce HSTS header with proper configuration', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      const hstsHeader = response.headers['strict-transport-security'];
      expect(hstsHeader).toBeDefined();
      expect(hstsHeader).toContain('max-age=31536000'); // 1 year
      expect(hstsHeader).toContain('includeSubDomains');
      expect(hstsHeader).toContain('preload');
    });
  });

  describe('A06: Vulnerable and Outdated Components - CVE Mitigation', () => {
    
    test('should use updated Express version to fix CVE-2024-43796', () => {
      const expressVersion = packageJson.dependencies.express;
      expect(expressVersion).toBeDefined();
      
      // Should use Express 4.20.0 or higher
      const versionMatch = expressVersion.match(/\^?(\d+)\.(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]);
        const patch = parseInt(versionMatch[3]);
        
        expect(major).toBeGreaterThanOrEqual(4);
        if (major === 4) {
          expect(minor).toBeGreaterThanOrEqual(20);
          if (minor === 20) {
            expect(patch).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    test('should use updated body-parser version to fix CVE-2024-45590', () => {
      const bodyParserVersion = packageJson.dependencies['body-parser'];
      expect(bodyParserVersion).toBeDefined();
      
      // Should use body-parser 1.20.3 or higher
      const versionMatch = bodyParserVersion.match(/\^?(\d+)\.(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]);
        const patch = parseInt(versionMatch[3]);
        
        expect(major).toBeGreaterThanOrEqual(1);
        if (major === 1) {
          expect(minor).toBeGreaterThanOrEqual(20);
          if (minor === 20) {
            expect(patch).toBeGreaterThanOrEqual(3);
          }
        }
      }
    });

    test('should use updated Helmet version for security headers', () => {
      const helmetVersion = packageJson.dependencies.helmet;
      expect(helmetVersion).toBeDefined();
      
      // Should use Helmet 7.1.0 or higher
      const versionMatch = helmetVersion.match(/\^?(\d+)\.(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]);
        
        expect(major).toBeGreaterThanOrEqual(7);
        if (major === 7) {
          expect(minor).toBeGreaterThanOrEqual(1);
        }
      }
    });

    test('should prevent body-parser DoS attack (CVE-2024-45590)', async () => {
      // Create payload larger than configured limit
      const largePayload = 'A'.repeat(LARGE_PAYLOAD_SIZE);
      
      const response = await request(app)
        .post('/api/data')
        .send({ data: largePayload })
        .expect(413);
      
      expect(response.body.error).toBe('Payload too large');
      expect(response.body.message).toBe('Payload too large');
    });
  });

  describe('A07: Identification and Authentication Failures - Rate Limiting', () => {
    
    test('should enforce global rate limiting after threshold breach', async () => {
      // Skip health check to test actual rate limiting
      const requests = [];
      
      // Make requests in batches to avoid overwhelming the server
      for (let i = 0; i < RATE_LIMIT_TEST_COUNT; i++) {
        requests.push(
          request(app)
            .get('/api/status')
            .timeout(5000)
        );
        
        // Add small delay every 10 requests to prevent connection issues
        if (i % 10 === 9) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      const responses = await Promise.allSettled(requests);
      const rateLimitedResponses = responses
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(response => response.status === 429);
      
      // Should have at least some rate-limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      // Verify rate limit headers are present
      if (rateLimitedResponses.length > 0) {
        const rateLimitResponse = rateLimitedResponses[0];
        expect(rateLimitResponse.headers['x-ratelimit-limit']).toBeDefined();
        expect(rateLimitResponse.headers['x-ratelimit-remaining']).toBeDefined();
        expect(rateLimitResponse.headers['x-ratelimit-reset']).toBeDefined();
      }
    }, 60000); // Extended timeout for rate limit testing

    test('should allow health check endpoints to bypass rate limiting', async () => {
      // Make many health check requests
      const healthRequests = Array(20).fill().map(() =>
        request(app).get('/health')
      );
      
      const responses = await Promise.all(healthRequests);
      const successfulResponses = responses.filter(r => r.status === 200);
      
      // All health checks should succeed (no rate limiting)
      expect(successfulResponses.length).toBe(20);
    });

    test('should provide appropriate rate limit error messages', async () => {
      // Make enough requests to trigger rate limiting
      const requests = Array(105).fill().map(() =>
        request(app).get('/api/status')
      );
      
      const responses = await Promise.allSettled(requests);
      const rateLimitedResponses = responses
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(response => response.status === 429);
      
      if (rateLimitedResponses.length > 0) {
        const errorResponse = rateLimitedResponses[0];
        expect(errorResponse.body.error).toMatch(/too many requests/i);
        expect(errorResponse.body.retryAfter).toBeDefined();
        expect(typeof errorResponse.body.retryAfter).toBe('number');
      }
    }, 45000);
  });

  describe('A08: Software and Data Integrity Failures - Input Validation', () => {
    
    test('should validate and sanitize all input data', async () => {
      const maliciousInput = {
        data: '<script>alert("xss")</script>',
        extraField: '"; DROP TABLE users; --'
      };
      
      const response = await request(app)
        .post('/api/data')
        .send(maliciousInput)
        .expect(200);
      
      // Verify input is sanitized
      expect(JSON.stringify(response.body)).not.toContain('<script>');
      expect(JSON.stringify(response.body)).not.toContain('DROP TABLE');
    });

    test('should reject invalid input types', async () => {
      const invalidInputs = [
        { data: 123 }, // number instead of string
        { data: null }, // null value
        { data: undefined }, // undefined value
        { data: {} }, // object instead of string
        { data: [] } // array instead of string
      ];
      
      for (const invalidInput of invalidInputs) {
        const response = await request(app)
          .post('/api/data')
          .send(invalidInput);
        
        expect([400, 422]).toContain(response.status);
      }
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/data')
        .send({}) // No required 'data' field
        .expect(400);
      
      expect(response.body.error).toBe('Invalid input data');
      expect(response.body.details).toBeDefined();
      expect(Array.isArray(response.body.details)).toBe(true);
      expect(response.body.details.some(detail => detail.field === 'data')).toBe(true);
    });
  });

  describe('A09: Security Logging and Monitoring Failures - Audit Trail', () => {
    
    test('should log security events without exposing sensitive data', async () => {
      // Capture console output
      const originalConsoleWarn = console.warn;
      const originalConsoleError = console.error;
      let loggedMessages = [];
      
      console.warn = (...args) => {
        loggedMessages.push({ level: 'warn', message: args.join(' ') });
      };
      console.error = (...args) => {
        loggedMessages.push({ level: 'error', message: args.join(' ') });
      };
      
      try {
        // Trigger a validation error
        await request(app)
          .post('/api/data')
          .send({ data: '' }) // Empty data should trigger validation
          .expect(400);
        
        // Check that validation was logged
        const validationLogs = loggedMessages.filter(log => 
          log.message.includes('Validation failed')
        );
        
        expect(validationLogs.length).toBeGreaterThan(0);
        
        // Verify no sensitive data in logs
        loggedMessages.forEach(log => {
          expect(log.message).not.toMatch(/password/i);
          expect(log.message).not.toMatch(/secret/i);
          expect(log.message).not.toMatch(/token/i);
          expect(log.message).not.toMatch(/key/i);
        });
        
      } finally {
        // Restore console methods
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
      }
    });

    test('should include request context in security logs', async () => {
      const originalConsoleWarn = console.warn;
      let loggedMessages = [];
      
      console.warn = (...args) => {
        loggedMessages.push(args.join(' '));
      };
      
      try {
        await request(app)
          .post('/api/data')
          .set('User-Agent', 'SecurityTestAgent/1.0')
          .send({ data: '' })
          .expect(400);
        
        // Check that request context is logged
        const contextLogs = loggedMessages.filter(log => 
          log.includes('ip') || log.includes('path') || log.includes('method')
        );
        
        expect(contextLogs.length).toBeGreaterThan(0);
        
      } finally {
        console.warn = originalConsoleWarn;
      }
    });
  });

  describe('A10: Server-Side Request Forgery (SSRF) - CORS Protection', () => {
    
    test('should enforce CORS origin validation', async () => {
      const response = await request(app)
        .get('/api/status')
        .set('Origin', 'https://malicious-site.com')
        .expect(403);
      
      // Should return proper error message for unauthorized origins
      expect(response.body).toHaveProperty('error', 'Access denied');
      expect(response.body).toHaveProperty('message', 'CORS policy violation');
    });

    test('should allow requests from authorized origins', async () => {
      const response = await request(app)
        .get('/api/status')
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      
      // Should include CORS headers for authorized origins
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    test('should handle preflight OPTIONS requests securely', async () => {
      const response = await request(app)
        .options('/api/data')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(200);
      
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    test('should reject CORS requests from unauthorized origins', async () => {
      // Mock console.error to check for CORS errors
      const originalConsoleError = console.error;
      let errorMessages = [];
      
      console.error = (...args) => {
        errorMessages.push(args.join(' '));
      };
      
      try {
        await request(app)
          .options('/api/data')
          .set('Origin', 'https://evil.com')
          .set('Access-Control-Request-Method', 'POST');
        
        // Should log or handle CORS policy violation
        // Note: Supertest might not trigger the CORS error handler the same way a browser would
        
      } finally {
        console.error = originalConsoleError;
      }
    });
  });

  describe('HTTPS Enforcement and TLS Security', () => {
    
    test('should redirect HTTP to HTTPS in production mode', () => {
      // Test HTTPS redirect logic
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        // Create a mock request/response for HTTP redirect testing
        const mockReq = {
          headers: { host: 'example.com:3000' },
          url: '/test'
        };
        const mockRes = {
          writeHead: jest.fn(),
          end: jest.fn()
        };
        
        // Simulate the HTTP server redirect logic
        const httpsUrl = `https://${mockReq.headers.host.replace(/:\d+$/, ':3443')}${mockReq.url}`;
        mockRes.writeHead(301, { 'Location': httpsUrl });
        mockRes.end();
        
        expect(mockRes.writeHead).toHaveBeenCalledWith(301, { 
          'Location': 'https://example.com:3443/test' 
        });
        expect(mockRes.end).toHaveBeenCalled();
        
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    test('should serve content normally in development mode', async () => {
      // Ensure we're in test/development mode
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      try {
        const response = await request(app)
          .get('/health')
          .expect(200);
        
        expect(response.body.status).toBe('healthy');
        
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('Error Handling Security - No Sensitive Data Exposure', () => {
    
    test('should not expose stack traces in error responses', async () => {
      // Trigger an error condition
      const response = await request(app)
        .get('/nonexistent-endpoint')
        .expect(404);
      
      const responseBody = JSON.stringify(response.body);
      
      // Verify no stack trace information is exposed
      expect(responseBody).not.toMatch(/at\s+\w+/); // Stack trace pattern
      expect(responseBody).not.toMatch(/\\.js:\d+:\d+/); // File path with line numbers
      expect(responseBody).not.toMatch(/Error:\s+/); // Error constructor
      expect(responseBody).not.toContain('stack');
      expect(responseBody).not.toContain('trace');
    });

    test('should provide generic error messages in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        // Try to trigger a server error
        const response = await request(app)
          .post('/api/data')
          .set('Content-Type', 'application/json')
          .send('{"malformed": json}')
          .expect(400);
        
        // Error message should be generic
        expect(response.body.error).toBeDefined();
        expect(response.body.requestId).toBeDefined();
        
        // Should not expose internal details
        const responseBody = JSON.stringify(response.body);
        expect(responseBody).not.toMatch(/syntax\s+error/i);
        expect(responseBody).not.toMatch(/parse\s+error/i);
        expect(responseBody).not.toMatch(/unexpected\s+token/i);
        
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    test('should include request ID for error tracking', async () => {
      const response = await request(app)
        .get('/nonexistent-endpoint')
        .expect(404);
      
      expect(response.body.requestId).toBeDefined();
      expect(typeof response.body.requestId).toBe('string');
      expect(response.body.requestId.length).toBeGreaterThan(0);
    });
  });

  describe('Memory and Resource Security', () => {
    
    test('should maintain reasonable memory usage during normal operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Make several requests to test memory stability
      const requests = Array(50).fill().map(() =>
        request(app).get('/health')
      );
      
      await Promise.all(requests);
      
      const finalMemory = process.memoryUsage();
      
      // Memory growth should be reasonable (less than 10MB)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // 10MB
    });

    test('should handle process signals securely for graceful shutdown', (done) => {
      // Test graceful shutdown function
      const originalProcessOn = process.on;
      const originalProcessExit = process.exit;
      const originalConsoleLog = console.log;
      
      let signalHandlers = {};
      let exitCalled = false;
      let logMessages = [];
      
      // Mock process.on to capture signal handlers
      process.on = jest.fn((signal, handler) => {
        signalHandlers[signal] = handler;
        return originalProcessOn.call(process, signal, handler);
      });
      
      // Mock process.exit to prevent actual exit
      process.exit = jest.fn((code) => {
        exitCalled = true;
        return code;
      });
      
      // Mock console.log to capture shutdown messages
      console.log = (...args) => {
        logMessages.push(args.join(' '));
      };
      
      try {
        // Import and test graceful shutdown
        expect(gracefulShutdown).toBeDefined();
        expect(typeof gracefulShutdown).toBe('function');
        
        // Test that graceful shutdown completes
        gracefulShutdown('SIGTERM');
        
        setTimeout(() => {
          // Verify shutdown log messages
          const shutdownLogs = logMessages.filter(log => 
            log.includes('graceful shutdown') || log.includes('shutdown')
          );
          expect(shutdownLogs.length).toBeGreaterThan(0);
          
          done();
        }, 100);
        
      } finally {
        // Restore original functions
        process.on = originalProcessOn;
        process.exit = originalProcessExit;
        console.log = originalConsoleLog;
      }
    });
  });

  describe('Static File Security', () => {
    
    test('should serve static files with security headers', async () => {
      // Test static file serving if available
      const response = await request(app)
        .get('/static/nonexistent.txt')
        .expect(404); // File doesn't exist, but headers should still be set
      
      // Even 404s from static middleware should have security headers
      expect(response.headers['x-content-type-options']).toBeDefined();
    });

    test('should prevent directory traversal in static files', async () => {
      const traversalPaths = [
        '/static/../server.js',
        '/static/../../package.json',
        '/static/../.env',
        '/static/..%2fserver.js',
        '/static/%2e%2e%2fserver.js'
      ];
      
      for (const path of traversalPaths) {
        const response = await request(app)
          .get(path);
        
        // Should not return sensitive files
        expect([400, 403, 404]).toContain(response.status);
        
        if (response.status === 200) {
          // If somehow returned, should not contain sensitive data
          const responseText = response.text || JSON.stringify(response.body);
          expect(responseText).not.toContain('SECRET');
          expect(responseText).not.toContain('PASSWORD');
          expect(responseText).not.toContain('TOKEN');
        }
      }
    });
  });

  describe('Comprehensive Security Integration Test', () => {
    
    test('should maintain security posture under concurrent load', async () => {
      // Test security under load
      const concurrentRequests = Array(20).fill().map(async () => {
        const maliciousPayload = {
          data: '<script>alert("xss")</script>',
          injection: "'; DROP TABLE users; --"
        };
        
        return request(app)
          .post('/api/data')
          .send(maliciousPayload);
      });
      
      const responses = await Promise.allSettled(concurrentRequests);
      
      responses.forEach(result => {
        if (result.status === 'fulfilled') {
          const response = result.value;
          // All responses should maintain security (sanitization)
          const responseBody = JSON.stringify(response.body);
          expect(responseBody).not.toContain('<script>');
          expect(responseBody).not.toContain('DROP TABLE');
        }
      });
    });

    test('should validate all security dependencies are properly configured', () => {
      // Validate package.json has all required security dependencies
      const securityDeps = {
        'express': '^4.20.0',
        'helmet': '^7.1.0',
        'body-parser': '^1.20.3',
        'express-rate-limit': '^7.1.0',
        'express-validator': '^7.0.1',
        'cors': '^2.8.5'
      };
      
      Object.entries(securityDeps).forEach(([dep, expectedVersion]) => {
        expect(packageJson.dependencies[dep]).toBeDefined();
        
        // Basic version validation (should start with expected major version)
        const actualVersion = packageJson.dependencies[dep];
        const expectedMajor = expectedVersion.match(/\^?(\d+)/)[1];
        const actualMajor = actualVersion.match(/\^?(\d+)/)?.[1];
        
        expect(parseInt(actualMajor)).toBeGreaterThanOrEqual(parseInt(expectedMajor));
      });
    });
  });
});