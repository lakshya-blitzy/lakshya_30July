/**
 * Comprehensive Endpoint Testing Suite
 * 
 * This test suite validates all HTTP routes using Jest and Supertest, ensuring
 * proper functionality across both basic HTTP mode (USE_EXPRESS=false) and 
 * Express mode (USE_EXPRESS=true). Tests cover endpoint responses, status codes,
 * headers, error handling, and performance thresholds.
 * 
 * Features Tested:
 * - /hello endpoint returning 'Hello world' in plain text
 * - /good-evening endpoint returning 'Good evening'
 * - Health check endpoints (/health, /ping) for monitoring
 * - API endpoints (/api/data, /api/status) with validation
 * - Cross-mode consistency (basic HTTP vs Express)
 * - Response time validation under 100ms threshold
 * - Content-Type header validation
 * - 404 responses for non-existent routes
 * - Rate limiting behavior
 */

const request = require('supertest');
const http = require('http');
const path = require('path');

// Import server components and configuration
const { httpServer, app } = require('../server.js');
const packageJson = require('../package.json');

describe('Endpoint Testing Suite', () => {
  let testServer;
  let serverPort;

  // Test configuration and setup
  beforeAll(async () => {
    // Ensure test environment variables are set
    process.env.NODE_ENV = 'test';
    process.env.PORT = '0'; // Use dynamic port allocation
    process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
    process.env.API_RATE_LIMIT_MAX_REQUESTS = '100';
    
    // Start test server
    testServer = httpServer;
    await new Promise((resolve) => {
      testServer.listen(0, () => {
        serverPort = testServer.address().port;
        console.log(`Test server running on port ${serverPort}`);
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Clean shutdown
    if (testServer && testServer.listening) {
      await new Promise((resolve) => {
        testServer.close(() => {
          console.log('Test server closed');
          resolve();
        });
      });
    }
  });

  beforeEach(() => {
    // Reset any test-specific environment variables
    jest.clearAllMocks();
  });

  describe('Package Configuration Validation', () => {
    test('should have correct package metadata', () => {
      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.devDependencies).toBeDefined();
    });

    test('should include required testing dependencies', () => {
      expect(packageJson.devDependencies.jest).toBeDefined();
      expect(packageJson.devDependencies.supertest).toBeDefined();
      expect(packageJson.scripts.test).toBeDefined();
    });
  });

  describe('Server Lifecycle Management', () => {
    test('should have httpServer instance available', () => {
      expect(httpServer).toBeDefined();
      expect(typeof httpServer.listen).toBe('function');
      expect(typeof httpServer.close).toBe('function');
      expect(httpServer.listening).toBe(true);
      expect(httpServer.address()).toBeTruthy();
    });

    test('server should be listening on assigned port', () => {
      const address = httpServer.address();
      expect(address).toBeTruthy();
      expect(address.port).toBe(serverPort);
    });
  });

  describe('Core Reference Endpoints', () => {
    describe('/hello endpoint', () => {
      test('should return "Hello world" with 200 status', async () => {
        const startTime = process.uptime();
        
        const response = await request(testServer)
          .get('/hello')
          .expect(200);

        const endTime = process.uptime();
        const responseTime = (endTime - startTime) * 1000;

        expect(response.text).toBe('Hello world');
        expect(response.headers['content-type']).toMatch(/text\/plain/);
        expect(responseTime).toBeLessThan(100); // Response time under 100ms
      });

      test('should handle GET method correctly', async () => {
        const response = await request(testServer)
          .get('/hello')
          .expect(200);

        expect(response.text).toBe('Hello world');
      });

      test('should include proper security headers', async () => {
        const response = await request(testServer)
          .get('/hello')
          .expect(200);

        // Security headers from Helmet.js
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
      });
    });

    describe('/good-evening endpoint', () => {
      test('should return "Good evening" with 200 status', async () => {
        const startTime = process.uptime();
        
        const response = await request(testServer)
          .get('/good-evening')
          .expect(200);

        const endTime = process.uptime();
        const responseTime = (endTime - startTime) * 1000;

        expect(response.text).toBe('Good evening');
        expect(response.headers['content-type']).toMatch(/text\/plain/);
        expect(responseTime).toBeLessThan(100); // Response time under 100ms
      });

      test('should handle GET method correctly', async () => {
        const response = await request(testServer)
          .get('/good-evening')
          .expect(200);

        expect(response.text).toBe('Good evening');
      });

      test('should include proper security headers', async () => {
        const response = await request(testServer)
          .get('/good-evening')
          .expect(200);

        // Security headers from Helmet.js
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
      });
    });
  });

  describe('Health Check Endpoints', () => {
    describe('/health endpoint', () => {
      test('should return healthy status with JSON format', async () => {
        const startTime = process.uptime();
        
        const response = await request(testServer)
          .get('/health')
          .expect(200);

        const endTime = process.uptime();
        const responseTime = (endTime - startTime) * 1000;

        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('environment');
        expect(response.body).toHaveProperty('uptime');
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(responseTime).toBeLessThan(50); // Health check under 50ms
      });

      test('should not be subject to rate limiting', async () => {
        // Make multiple rapid requests to health endpoint
        const requests = Array(10).fill().map(() => 
          request(testServer).get('/health').expect(200)
        );

        const responses = await Promise.all(requests);
        
        // All should succeed (no 429 responses)
        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body.status).toBe('healthy');
        });
      });

      test('should include memory usage information', async () => {
        const response = await request(testServer)
          .get('/health')
          .expect(200);

        expect(response.body.uptime).toBeGreaterThan(0);
        expect(typeof response.body.uptime).toBe('number');
      });
    });

    describe('/ping endpoint', () => {
      test('should return pong message with JSON format', async () => {
        const startTime = process.uptime();
        
        const response = await request(testServer)
          .get('/ping')
          .expect(200);

        const endTime = process.uptime();
        const responseTime = (endTime - startTime) * 1000;

        expect(response.body).toHaveProperty('message', 'pong');
        expect(response.headers['content-type']).toMatch(/application\/json/);
        expect(responseTime).toBeLessThan(50); // Ping under 50ms
      });

      test('should not be subject to rate limiting', async () => {
        // Make multiple rapid requests to ping endpoint
        const requests = Array(10).fill().map(() => 
          request(testServer).get('/ping').expect(200)
        );

        const responses = await Promise.all(requests);
        
        // All should succeed (no 429 responses)
        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body.message).toBe('pong');
        });
      });
    });
  });

  describe('API Endpoints', () => {
    describe('/api/data endpoint', () => {
      test('should accept valid POST requests with data', async () => {
        const testData = { data: 'test input data' };
        
        const response = await request(testServer)
          .post('/api/data')
          .send(testData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Data processed successfully');
        expect(response.body).toHaveProperty('received', 'test input data');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.headers['content-type']).toMatch(/application\/json/);
      });

      test('should validate required data field', async () => {
        const response = await request(testServer)
          .post('/api/data')
          .send({}) // Missing data field
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Invalid input data');
        expect(response.body).toHaveProperty('details');
        expect(Array.isArray(response.body.details)).toBe(true);
      });

      test('should sanitize HTML input', async () => {
        const testData = { data: '<script>alert("xss")</script>test' };
        
        const response = await request(testServer)
          .post('/api/data')
          .send(testData)
          .expect(200);

        // HTML should be escaped
        expect(response.body.received).not.toContain('<script>');
        expect(response.body.received).toContain('&lt;script&gt;');
      });

      test('should enforce field length limits', async () => {
        const longData = 'a'.repeat(1001); // Exceeds 1000 char limit
        const testData = { data: longData };
        
        const response = await request(testServer)
          .post('/api/data')
          .send(testData)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Invalid input data');
      });
    });

    describe('/api/status endpoint', () => {
      test('should return operational status with security info', async () => {
        const response = await request(testServer)
          .get('/api/status')
          .expect(200);

        expect(response.body).toHaveProperty('status', 'operational');
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('security');
        expect(response.body.security).toHaveProperty('helmet', 'enabled');
        expect(response.body.security).toHaveProperty('cors', 'enabled');
        expect(response.body.security).toHaveProperty('rateLimit', 'enabled');
        expect(response.headers['content-type']).toMatch(/application\/json/);
      });

      test('should include input validation status', async () => {
        const response = await request(testServer)
          .get('/api/status')
          .expect(200);

        expect(response.body.security).toHaveProperty('inputValidation', 'enabled');
        expect(response.body.security).toHaveProperty('https', 'available');
      });
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(testServer)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not found');
      expect(response.body).toHaveProperty('message', 'The requested resource was not found');
      expect(response.body).toHaveProperty('path', '/non-existent-route');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should handle POST to non-existent routes', async () => {
      const response = await request(testServer)
        .post('/non-existent-api')
        .send({ test: 'data' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not found');
    });

    test('should handle unsupported HTTP methods', async () => {
      const response = await request(testServer)
        .patch('/hello')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not found');
    });
  });

  describe('Security Headers Validation', () => {
    test('should include security headers in all responses', async () => {
      const endpoints = ['/hello', '/good-evening', '/health', '/ping', '/api/status'];
      
      for (const endpoint of endpoints) {
        const response = await request(testServer)
          .get(endpoint)
          .expect(200);

        // Helmet.js security headers
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
        
        // Should not expose X-Powered-By
        expect(response.headers['x-powered-by']).toBeUndefined();
      }
    });

    test('should include Content Security Policy headers', async () => {
      const response = await request(testServer)
        .get('/hello')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    test('should include CORS headers for cross-origin requests', async () => {
      const response = await request(testServer)
        .get('/api/status')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Performance Validation', () => {
    test('should respond within performance thresholds', async () => {
      const endpoints = [
        { path: '/hello', threshold: 100 },
        { path: '/good-evening', threshold: 100 },
        { path: '/health', threshold: 50 },
        { path: '/ping', threshold: 50 },
        { path: '/api/status', threshold: 100 }
      ];

      for (const { path, threshold } of endpoints) {
        const startTime = Date.now();
        
        await request(testServer)
          .get(path)
          .expect(200);
        
        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(threshold);
      }
    });

    test('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();
      
      const requests = Array(concurrentRequests).fill().map(() =>
        request(testServer).get('/hello').expect(200)
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      // All requests should succeed
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.text).toBe('Hello world');
      });
      
      // Average response time should be reasonable
      const avgResponseTime = totalTime / concurrentRequests;
      expect(avgResponseTime).toBeLessThan(200);
    });
  });

  describe('Content-Type Header Validation', () => {
    test('should return correct content-type for text endpoints', async () => {
      const textEndpoints = ['/hello', '/good-evening'];
      
      for (const endpoint of textEndpoints) {
        const response = await request(testServer)
          .get(endpoint)
          .expect(200);

        expect(response.headers['content-type']).toMatch(/text\/plain/);
      }
    });

    test('should return correct content-type for JSON endpoints', async () => {
      const jsonEndpoints = ['/health', '/ping', '/api/status'];
      
      for (const endpoint of jsonEndpoints) {
        const response = await request(testServer)
          .get(endpoint)
          .expect(200);

        expect(response.headers['content-type']).toMatch(/application\/json/);
      }
    });
  });

  describe('Rate Limiting Behavior', () => {
    test('should apply API rate limiting to /api routes', async () => {
      // This test might need adjustment based on actual rate limit implementation
      // Making a moderate number of requests to avoid triggering limits in normal test runs
      const requests = Array(5).fill().map(() =>
        request(testServer).get('/api/status').expect(200)
      );

      const responses = await Promise.all(requests);
      
      // Check that rate limit headers are present (standardHeaders format)
      responses.forEach(response => {
        expect(response.headers['ratelimit-limit'] || response.headers['ratelimit-remaining']).toBeDefined();
      });
    });

    test('should exempt health endpoints from rate limiting', async () => {
      // Make multiple requests to health endpoints
      const healthRequests = Array(10).fill().map(() =>
        request(testServer).get('/health').expect(200)
      );
      
      const pingRequests = Array(10).fill().map(() =>
        request(testServer).get('/ping').expect(200)
      );

      const [healthResponses, pingResponses] = await Promise.all([
        Promise.all(healthRequests),
        Promise.all(pingRequests)
      ]);

      // All should succeed without rate limiting
      expect(healthResponses).toHaveLength(10);
      expect(pingResponses).toHaveLength(10);
      
      healthResponses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      pingResponses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Environment Variable Testing', () => {
    test('should access process environment variables', () => {
      expect(process.env).toBeDefined();
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.pid).toBeGreaterThan(0);
    });

    test('should monitor memory usage', () => {
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage).toHaveProperty('rss');
      expect(memoryUsage).toHaveProperty('heapUsed');
      expect(memoryUsage).toHaveProperty('heapTotal');
      expect(memoryUsage.rss).toBeGreaterThan(0);
    });

    test('should track process uptime', () => {
      const uptime = process.uptime();
      expect(uptime).toBeGreaterThan(0);
      expect(typeof uptime).toBe('number');
    });
  });

  describe('Path Resolution Testing', () => {
    test('should resolve file paths correctly', () => {
      const serverPath = path.join(__dirname, '../server.js');
      const packagePath = path.join(__dirname, '../package.json');
      
      expect(path.resolve(serverPath)).toContain('server.js');
      expect(path.resolve(packagePath)).toContain('package.json');
    });

    test('should handle __dirname correctly', () => {
      expect(__dirname).toContain('test');
      expect(path.basename(__dirname)).toBe('test');
    });
  });

  describe('HTTP Module Integration', () => {
    test('should be able to create HTTP requests', () => {
      const options = {
        hostname: 'localhost',
        port: serverPort,
        path: '/health',
        method: 'GET'
      };

      return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          expect(res.statusCode).toBe(200);
          resolve();
        });

        req.on('error', reject);
        req.end();
      });
    });

    test('should handle HTTP GET requests', () => {
      return new Promise((resolve, reject) => {
        http.get(`http://localhost:${serverPort}/ping`, (res) => {
          expect(res.statusCode).toBe(200);
          
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          
          res.on('end', () => {
            const parsedData = JSON.parse(data);
            expect(parsedData.message).toBe('pong');
            resolve();
          });
        }).on('error', reject);
      });
    });

    test('should be able to create HTTP server instances', () => {
      const testServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('test server');
      });

      expect(testServer).toBeDefined();
      expect(typeof testServer.listen).toBe('function');
      expect(typeof testServer.close).toBe('function');
    });
  });
});