# Testing Guide

## Overview

This guide covers comprehensive testing setup and implementation for your Node.js "Hello World" server project, providing detailed instructions for unit testing, integration testing, coverage reporting, and CI/CD integration. The testing strategies outlined here support both basic HTTP server functionality and enhanced Backprop integration scenarios.

## Prerequisites

Before implementing testing for your Node.js server, ensure you have:

- **Node.js 14+** installed on your system
- **npm** or **yarn** package manager
- Basic understanding of JavaScript and HTTP concepts
- Familiarity with testing concepts (unit tests, integration tests)

## Testing Framework Comparison

### Jest vs Mocha: Framework Selection

| Feature | Jest | Mocha |
|---------|------|-------|
| **Built-in Assertions** | ✅ Built-in expect() | ❌ Requires chai |
| **Test Runner** | ✅ Integrated | ✅ Integrated |
| **Code Coverage** | ✅ Built-in --coverage | ❌ Requires nyc |
| **Mocking** | ✅ Built-in mocking | ❌ Requires sinon |
| **Snapshot Testing** | ✅ Native support | ❌ Third-party |
| **Configuration** | 📄 Minimal setup | 📄 More configuration |
| **Performance** | ⚡ Parallel by default | ⚡ Sequential by default |

### Recommended Approach

For Node.js HTTP server testing, **Jest** is recommended due to:
- Minimal configuration requirements
- Built-in coverage reporting
- Comprehensive mocking capabilities
- Better developer experience with snapshot testing

## Installation and Setup

### Installing Jest

```bash
# Install Jest as a development dependency
npm install --save-dev jest

# For HTTP testing utilities
npm install --save-dev supertest

# For advanced mocking (optional)
npm install --save-dev jest-mock
```

### Installing Mocha (Alternative)

```bash
# Install Mocha test framework
npm install --save-dev mocha

# Install assertion library
npm install --save-dev chai

# Install HTTP testing library
npm install --save-dev supertest

# Install coverage tool
npm install --save-dev nyc
```

### Package.json Configuration

Add testing scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:mocha": "mocha test/**/*.test.js",
    "test:mocha-coverage": "nyc mocha test/**/*.test.js"
  },
  "jest": {
    "testEnvironment": "node",
    "collectCoverageFrom": [
      "*.js",
      "!node_modules/**",
      "!test/**",
      "!coverage/**"
    ],
    "coverageReporters": ["text", "lcov", "html"],
    "testMatch": ["**/test/**/*.test.js"]
  }
}
```

## Writing Unit Tests

### Basic Server Testing Structure

Create a test directory structure:

```
project/
├── server.js
├── package.json
├── test/
│   ├── server.test.js
│   ├── endpoints.test.js
│   └── integration.test.js
└── coverage/ (generated)
```

### Core Server Tests (Jest)

Create `test/server.test.js`:

```javascript
const request = require('supertest');
const http = require('http');

// Mock server implementation for testing
function createTestServer() {
  return http.createServer((req, res) => {
    if (req.url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Hello, World!\n');
    } else if (req.url === '/hello' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Hello world');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });
}

describe('Node.js HTTP Server', () => {
  let server;

  beforeAll(() => {
    server = createTestServer();
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('GET /', () => {
    test('should return Hello, World! message', async () => {
      const response = await request(server)
        .get('/')
        .expect(200);

      expect(response.text).toBe('Hello, World!\n');
      expect(response.headers['content-type']).toBe('text/plain');
    });

    test('should have correct status code', async () => {
      await request(server)
        .get('/')
        .expect(200);
    });

    test('should have correct content type header', async () => {
      const response = await request(server)
        .get('/');

      expect(response.headers['content-type']).toBe('text/plain');
    });
  });

  describe('GET /hello', () => {
    test('should return Hello world message', async () => {
      const response = await request(server)
        .get('/hello')
        .expect(200);

      expect(response.text).toBe('Hello world');
      expect(response.headers['content-type']).toBe('text/plain');
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent routes', async () => {
      await request(server)
        .get('/nonexistent')
        .expect(404);
    });

    test('should return Not Found message for 404 errors', async () => {
      const response = await request(server)
        .get('/invalid-route')
        .expect(404);

      expect(response.text).toBe('Not Found');
    });
  });

  describe('HTTP Methods', () => {
    test('should handle POST requests appropriately', async () => {
      await request(server)
        .post('/')
        .expect(404); // Assuming POST is not implemented
    });

    test('should handle PUT requests appropriately', async () => {
      await request(server)
        .put('/')
        .expect(404); // Assuming PUT is not implemented
    });

    test('should handle DELETE requests appropriately', async () => {
      await request(server)
        .delete('/')
        .expect(404); // Assuming DELETE is not implemented
    });
  });

  describe('Response Headers', () => {
    test('should set correct Content-Type header', async () => {
      const response = await request(server)
        .get('/');

      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers['content-type']).toBe('text/plain');
    });

    test('should include standard HTTP headers', async () => {
      const response = await request(server)
        .get('/');

      expect(response.headers).toHaveProperty('date');
      expect(response.headers).toHaveProperty('connection');
    });
  });
});
```

### Alternative Mocha Tests

Create `test/server.mocha.test.js`:

```javascript
const request = require('supertest');
const { expect } = require('chai');
const http = require('http');

// Mock server implementation
function createTestServer() {
  return http.createServer((req, res) => {
    if (req.url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Hello, World!\n');
    } else if (req.url === '/hello' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Hello world');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });
}

describe('Node.js HTTP Server (Mocha)', function() {
  let server;

  before(function() {
    server = createTestServer();
  });

  after(function(done) {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('GET /', function() {
    it('should return Hello, World! message', function(done) {
      request(server)
        .get('/')
        .expect(200)
        .expect('Content-Type', 'text/plain')
        .end((err, res) => {
          if (err) return done(err);
          expect(res.text).to.equal('Hello, World!\n');
          done();
        });
    });

    it('should have correct headers', function(done) {
      request(server)
        .get('/')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.headers).to.have.property('content-type');
          expect(res.headers['content-type']).to.equal('text/plain');
          done();
        });
    });
  });

  describe('GET /hello', function() {
    it('should return Hello world message', function(done) {
      request(server)
        .get('/hello')
        .expect(200)
        .expect('Hello world')
        .end(done);
    });
  });

  describe('Error Handling', function() {
    it('should return 404 for non-existent routes', function(done) {
      request(server)
        .get('/nonexistent')
        .expect(404)
        .end(done);
    });
  });
});
```

## Advanced Testing Scenarios

### Testing with Different Environments

Create `test/environment.test.js`:

```javascript
const request = require('supertest');

describe('Environment-based Testing', () => {
  let server;
  
  beforeEach(() => {
    // Mock different environment configurations
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    
    // Create server with test configuration
    server = require('../server'); // Assuming server exports the server instance
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = process.env.NODE_ENV;
    if (server && server.close) {
      server.close();
    }
  });

  test('should handle test environment configuration', async () => {
    expect(process.env.NODE_ENV).toBe('test');
    
    const response = await request(server)
      .get('/')
      .expect(200);
    
    expect(response.text).toContain('Hello');
  });
});
```

### Performance Testing

Create `test/performance.test.js`:

```javascript
const request = require('supertest');
const http = require('http');

describe('Performance Tests', () => {
  let server;

  beforeAll(() => {
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Hello, World!\n');
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  test('should respond within acceptable time limit', async () => {
    const startTime = Date.now();
    
    await request(server)
      .get('/')
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(100); // Response should be under 100ms
  });

  test('should handle concurrent requests', async () => {
    const requests = Array(10).fill().map(() => 
      request(server)
        .get('/')
        .expect(200)
    );

    const startTime = Date.now();
    await Promise.all(requests);
    const totalTime = Date.now() - startTime;

    expect(totalTime).toBeLessThan(1000); // All requests should complete within 1 second
  });
});
```

## Coverage Configuration

### Jest Coverage Setup

Jest provides built-in coverage reporting. Configure in `package.json`:

```json
{
  "jest": {
    "collectCoverage": true,
    "coverageDirectory": "coverage",
    "collectCoverageFrom": [
      "**/*.js",
      "!node_modules/**",
      "!test/**",
      "!coverage/**",
      "!jest.config.js"
    ],
    "coverageReporters": ["text", "lcov", "html", "json"],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### NYC (Istanbul) Coverage for Mocha

Configure `.nycrc.json`:

```json
{
  "reporter": ["text", "html", "lcov"],
  "exclude": [
    "test/**",
    "coverage/**",
    "node_modules/**"
  ],
  "all": true,
  "check-coverage": true,
  "statements": 80,
  "branches": 80,
  "functions": 80,
  "lines": 80
}
```

### Running Coverage Reports

```bash
# Jest coverage
npm run test:coverage

# Mocha with NYC coverage
npm run test:mocha-coverage

# Open HTML coverage report
open coverage/lcov-report/index.html
```

## CI/CD Integration

### GitHub Actions Configuration

Create `.github/workflows/test.yml`:

```yaml
name: Node.js CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [14.x, 16.x, 18.x]

    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint
      continue-on-error: true

    - name: Run tests
      run: npm test

    - name: Run tests with coverage
      run: npm run test:coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
        fail_ci_if_error: false

    - name: Upload coverage reports
      uses: actions/upload-artifact@v3
      with:
        name: coverage-report-${{ matrix.node-version }}
        path: coverage/
```

### Jenkins Pipeline Configuration

Create `Jenkinsfile`:

```groovy
pipeline {
    agent any
    
    tools {
        nodejs '16.x'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }
        
        stage('Lint') {
            steps {
                sh 'npm run lint || true'
            }
        }
        
        stage('Test') {
            steps {
                sh 'npm test'
            }
            post {
                always {
                    publishTestResults(
                        testResultsPattern: 'test-results.xml',
                        allowEmptyResults: true
                    )
                }
            }
        }
        
        stage('Coverage') {
            steps {
                sh 'npm run test:coverage'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage/lcov-report',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            echo 'Tests passed successfully!'
        }
        failure {
            echo 'Tests failed. Check the logs for details.'
        }
    }
}
```

## Test-Driven Development (TDD)

### TDD Workflow for HTTP Server

1. **Write Failing Test First**:

```javascript
// test/new-feature.test.js
describe('New Feature', () => {
  test('should implement new endpoint /status', async () => {
    const response = await request(server)
      .get('/status')
      .expect(200);
    
    expect(response.text).toBe('Server is running');
  });
});
```

2. **Run Test (Should Fail)**:
```bash
npm test
# Test should fail because /status endpoint doesn't exist
```

3. **Implement Minimal Code**:
```javascript
// Add to server.js
if (req.url === '/status' && req.method === 'GET') {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server is running');
}
```

4. **Run Test (Should Pass)**:
```bash
npm test
# Test should now pass
```

5. **Refactor if Needed**:
```javascript
// Refactor for better structure
const routes = {
  '/': () => 'Hello, World!\n',
  '/hello': () => 'Hello world',
  '/status': () => 'Server is running'
};
```

## Backprop Integration Testing

### Testing Backprop Integration Points

Create `test/backprop-integration.test.js`:

```javascript
const request = require('supertest');

describe('Backprop Integration', () => {
  let server;

  beforeAll(() => {
    // Mock Backprop configuration
    process.env.BACKPROP_ENABLED = 'true';
    process.env.BACKPROP_API_KEY = 'test-api-key';
    
    server = require('../server');
  });

  afterAll(() => {
    delete process.env.BACKPROP_ENABLED;
    delete process.env.BACKPROP_API_KEY;
    
    if (server && server.close) {
      server.close();
    }
  });

  test('should handle Backprop instrumentation', async () => {
    const response = await request(server)
      .get('/')
      .expect(200);
    
    // Verify Backprop headers are present (if applicable)
    expect(response.headers).toBeDefined();
    expect(response.text).toBe('Hello, World!\n');
  });

  test('should support Backprop monitoring endpoints', async () => {
    // Test monitoring endpoint if implemented
    await request(server)
      .get('/health')
      .expect(200);
  });

  test('should handle Backprop error tracking', async () => {
    // Test error scenarios with Backprop integration
    const response = await request(server)
      .get('/error-test')
      .expect(404);
    
    expect(response.text).toBe('Not Found');
  });
});
```

### Mock Backprop Services

Create `test/mocks/backprop.mock.js`:

```javascript
class BackpropMock {
  constructor() {
    this.events = [];
    this.metrics = {};
  }

  track(event, data) {
    this.events.push({ event, data, timestamp: Date.now() });
  }

  metric(name, value) {
    this.metrics[name] = value;
  }

  getEvents() {
    return this.events;
  }

  getMetrics() {
    return this.metrics;
  }

  reset() {
    this.events = [];
    this.metrics = {};
  }
}

module.exports = new BackpropMock();
```

## Common Testing Patterns

### Setup and Teardown

```javascript
describe('Server Tests', () => {
  let server;
  let originalEnv;

  beforeAll(() => {
    // Global setup
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    // Setup before each test
    server = createTestServer();
  });

  afterEach(() => {
    // Cleanup after each test
    if (server && server.close) {
      server.close();
    }
  });

  afterAll(() => {
    // Global cleanup
    process.env = originalEnv;
  });
});
```

### Mocking External Dependencies

```javascript
// Mock HTTP module
jest.mock('http', () => ({
  createServer: jest.fn((callback) => ({
    listen: jest.fn(),
    close: jest.fn(),
    on: jest.fn()
  }))
}));

// Mock file system operations
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true)
}));
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: Tests Timeout

```javascript
// Solution: Increase timeout for slow operations
describe('Slow operations', () => {
  test('should handle slow response', async () => {
    // ... test code
  }, 10000); // 10 second timeout
});
```

#### Issue: Port Already in Use

```javascript
// Solution: Use dynamic port assignment
const getPort = require('get-port');

beforeAll(async () => {
  const port = await getPort();
  server = createServer().listen(port);
});
```

#### Issue: Coverage Reports Not Generated

```bash
# Ensure coverage directory has write permissions
chmod 755 coverage/

# Clear Jest cache
npm test -- --clearCache

# Regenerate coverage
npm run test:coverage
```

### Best Practices

1. **Test Structure**: Follow AAA pattern (Arrange, Act, Assert)
2. **Test Isolation**: Each test should be independent
3. **Descriptive Names**: Use clear, descriptive test names
4. **Mock External Dependencies**: Don't test external services
5. **Consistent Assertions**: Use consistent assertion patterns
6. **Error Testing**: Always test error conditions
7. **Performance Awareness**: Monitor test execution time

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- test/server.test.js

# Run tests matching pattern
npm test -- --testNamePattern="GET /"
```

### CI/CD Environment

```bash
# Run tests with XML output for CI
npm test -- --reporters=default --reporters=jest-junit

# Run tests with coverage and upload
npm run test:coverage && codecov
```

## Next Steps

After implementing basic testing:

1. **Explore Advanced Testing**: Learn about integration testing, end-to-end testing
2. **Performance Testing**: Implement load testing with tools like Artillery or k6
3. **Security Testing**: Add security testing with tools like npm audit
4. **Documentation**: Generate test documentation with tools like JSDoc
5. **Monitoring**: Integrate application performance monitoring (APM) tools

## Related Guides

- [Getting Started Guide](./getting-started.md) - Initial setup and basic usage
- [Express.js Migration Guide](./express-migration.md) - Upgrading to Express.js framework
- [Production Guide](./production.md) - Production deployment with PM2
- [Security Guide](./security.md) - Security hardening and best practices
- [API Reference](../api/endpoints.md) - Complete API documentation

---

*This testing guide provides comprehensive coverage for testing your Node.js "Hello World" server with support for Backprop integration scenarios. For additional testing strategies or framework-specific guidance, consult the official documentation for Jest, Mocha, or your chosen testing framework.*