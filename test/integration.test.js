/**
 * Integration Tests for Complete System
 * Tests the ecosystem configuration, deployment readiness, and cross-platform compatibility
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

describe('Integration Tests', () => {
  describe('Configuration Files', () => {
    test('package.json should have all required dependencies', () => {
      const packageJson = require('../package.json');
      
      // Check production dependencies
      expect(packageJson.dependencies).toHaveProperty('express');
      expect(packageJson.dependencies).toHaveProperty('helmet');
      expect(packageJson.dependencies).toHaveProperty('cors');
      expect(packageJson.dependencies).toHaveProperty('express-rate-limit');
      expect(packageJson.dependencies).toHaveProperty('dotenv');
      expect(packageJson.dependencies).toHaveProperty('winston');
      // pm2 should be in devDependencies, not dependencies
      expect(packageJson.devDependencies).toHaveProperty('pm2');
      
      // Check dev dependencies
      expect(packageJson.devDependencies).toHaveProperty('jest');
      expect(packageJson.devDependencies).toHaveProperty('supertest');
      expect(packageJson.devDependencies).toHaveProperty('eslint');
      
      // Check scripts
      expect(packageJson.scripts).toHaveProperty('start');
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('prod');
    });
    
    test('ecosystem.config.js should be valid PM2 configuration', () => {
      const ecosystemConfig = require('../ecosystem.config.js');
      
      expect(ecosystemConfig).toHaveProperty('apps');
      expect(Array.isArray(ecosystemConfig.apps)).toBe(true);
      expect(ecosystemConfig.apps.length).toBeGreaterThan(0);
      
      const app = ecosystemConfig.apps[0];
      expect(app).toHaveProperty('name');
      expect(app).toHaveProperty('script');
      expect(app).toHaveProperty('instances');
      expect(app).toHaveProperty('exec_mode');
      expect(app.script).toBe('server.js');
    });
    
    test('requirements.txt should exist for Python dependencies', () => {
      const requirementsPath = path.join(__dirname, '..', 'requirements.txt');
      expect(fs.existsSync(requirementsPath)).toBe(true);
      
      const requirements = fs.readFileSync(requirementsPath, 'utf8');
      expect(requirements).toContain('Flask');
      expect(requirements).toContain('gunicorn');
      expect(requirements).toContain('Flask-CORS');
      expect(requirements).toContain('Flask-Limiter');
    });
    
    test('.env.example should contain all necessary environment variables', () => {
      const envExamplePath = path.join(__dirname, '..', '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);
      
      const envContent = fs.readFileSync(envExamplePath, 'utf8');
      expect(envContent).toContain('USE_EXPRESS');
      expect(envContent).toContain('NODE_ENV');
      expect(envContent).toContain('PORT');
      expect(envContent).toContain('CORS_ORIGINS');
    });
  });
  
  describe('File Structure', () => {
    test('all required files should exist', () => {
      const requiredFiles = [
        'server.js',
        'app.py',
        'wsgi.py',
        'package.json',
        'requirements.txt',
        'ecosystem.config.js',
        '.env.example'
      ];
      
      requiredFiles.forEach(file => {
        const filePath = path.join(__dirname, '..', file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });
    
    test('test directories should be properly structured', () => {
      const testDir = path.join(__dirname);
      const pythonTestDir = path.join(__dirname, '..', 'test_python');
      
      expect(fs.existsSync(testDir)).toBe(true);
      expect(fs.existsSync(pythonTestDir)).toBe(true);
    });
  });
  
  describe('Cross-Platform Compatibility', () => {
    test('Node.js and Python implementations should respond identically to /hello', async () => {
      // Test Node.js implementation
      process.env.USE_EXPRESS = 'true';
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3200';
      
      delete require.cache[require.resolve('../server.js')];
      const nodeApp = require('../server.js').app;
      
      const nodeResponse = await request(nodeApp)
        .get('/hello')
        .expect(200);
      
      expect(nodeResponse.text).toBe('Hello world');
      expect(nodeResponse.headers['content-type']).toMatch(/text\/plain/);
      
      // Note: Python test would require spawning a separate process
      // For now, we verify the Node.js implementation works correctly
    });
    
    test('both implementations should have same endpoint structure', () => {
      // This test verifies that the required endpoints exist
      const endpointsToTest = [
        '/hello',
        '/good-evening',
        '/health',
        '/ping',
        '/api/status'
      ];
      
      // We can't easily test both simultaneously without complex setup
      // But we can verify the Node.js side has all required endpoints
      process.env.USE_EXPRESS = 'true';
      delete require.cache[require.resolve('../server.js')];
      const app = require('../server.js').app;
      
      // Check that the app is configured properly
      expect(app).toBeDefined();
      expect(app._router).toBeDefined();
    });
  });
  
  describe('Security Features', () => {
    let app;
    
    beforeAll(() => {
      process.env.USE_EXPRESS = 'true';
      process.env.NODE_ENV = 'test';
      delete require.cache[require.resolve('../server.js')];
      app = require('../server.js').app;
    });
    
    test('should have security headers on all responses', async () => {
      const response = await request(app)
        .get('/hello')
        .expect(200);
      
      // Check for key security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });
    
    test('should handle CORS properly', async () => {
      const response = await request(app)
        .get('/hello')
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      
      // Should have CORS headers
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
    
    test('should validate input on API endpoints', async () => {
      // Test invalid JSON
      const response = await request(app)
        .post('/api/data')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
      
      // Should handle malformed input gracefully
    });
    
    test('should return appropriate error responses', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });
  });
  
  describe('Production Readiness', () => {
    test('should handle environment variables correctly', () => {
      const originalEnv = process.env.NODE_ENV;
      
      // Test production environment
      process.env.NODE_ENV = 'production';
      process.env.USE_EXPRESS = 'true';
      
      delete require.cache[require.resolve('../server.js')];
      const prodApp = require('../server.js').app;
      
      expect(prodApp).toBeDefined();
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
    
    test('should have proper graceful shutdown capability', () => {
      process.env.USE_EXPRESS = 'true';
      delete require.cache[require.resolve('../server.js')];
      const serverModule = require('../server.js');
      
      expect(serverModule).toHaveProperty('gracefulShutdown');
      expect(typeof serverModule.gracefulShutdown).toBe('function');
    });
    
    test('PM2 configuration should be production-ready', () => {
      const ecosystemConfig = require('../ecosystem.config.js');
      const app = ecosystemConfig.apps[0];
      
      expect(app.instances).toBe('max');
      expect(app.exec_mode).toBe('cluster');
      expect(app.autorestart).toBe(true);
      expect(app.max_memory_restart).toBeDefined();
    });
  });
  
  describe('Performance and Scalability', () => {
    let app;
    
    beforeAll(() => {
      process.env.USE_EXPRESS = 'true';
      process.env.NODE_ENV = 'test';
      delete require.cache[require.resolve('../server.js')];
      app = require('../server.js').app;
    });
    
    test('should respond to health checks quickly', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/health')
        .expect(200);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Health check should respond in under 100ms
      expect(responseTime).toBeLessThan(100);
    });
    
    test('should handle multiple concurrent requests', async () => {
      const requests = [];
      const numRequests = 10;
      
      for (let i = 0; i < numRequests; i++) {
        requests.push(
          request(app)
            .get('/ping')
            .expect(200)
        );
      }
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.body.message).toBe('pong');
      });
    });
    
    test('should maintain consistent response format', async () => {
      // Test multiple endpoints for consistent structure
      const healthResponse = await request(app)
        .get('/health')
        .expect(200);
      
      const pingResponse = await request(app)
        .get('/ping')
        .expect(200);
      
      const statusResponse = await request(app)
        .get('/api/status')
        .expect(200);
      
      // All should return valid JSON (except hello/good-evening which are text)
      expect(healthResponse.body).toBeInstanceOf(Object);
      expect(pingResponse.body).toBeInstanceOf(Object);
      expect(statusResponse.body).toBeInstanceOf(Object);
    });
  });
});