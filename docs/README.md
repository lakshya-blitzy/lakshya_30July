# Node.js Security-Hardened Server Documentation

> **🔒 Comprehensive security implementation for Node.js/Express.js applications following OWASP best practices**

## Project Overview

This documentation hub provides comprehensive guidance for implementing and maintaining a security-hardened Node.js server. The project addresses critical security vulnerabilities found in Node.js/Express.js applications and implements enterprise-grade security controls to achieve OWASP compliance.

### Security Focus

This project was developed in response to critical security vulnerabilities affecting Node.js/Express.js applications, including:

- **High Severity CVE-2024-45590** in body-parser middleware
- **Moderate Severity CVE-2024-43796** in Express core  
- **Cross-site scripting (XSS)** vulnerability in Express <4.20.0 via response.redirect()
- **Input validation failures** leading to SQL Injection, Command Injection, and other attacks
- **Missing security headers** exposing applications to various attacks
- **Lack of rate limiting** allowing denial of service attacks

## 🚀 Quick Start

### Prerequisites

- Node.js 14+ 
- npm 6+
- OpenSSL (for HTTPS certificate generation)

### Basic Setup

```bash
# Clone and install dependencies
git clone <repository-url>
cd <project-directory>
npm install

# Install security dependencies
npm install helmet@^7.1.0 express-rate-limit@^7.1.0 cors@^2.8.5 express-validator@^7.0.1

# Update vulnerable dependencies
npm install express@^4.20.0 body-parser@^1.20.3

# Start the server
npm start
```

### Quick Security Verification

```bash
# Check for vulnerabilities
npm audit

# Verify security headers (after starting server)
curl -I http://localhost:3000
```

## 🔐 Security Implementation Guide

### Core Security Features Implemented

| Security Control | Implementation | Protection Level |
|---|---|---|
| **Security Headers** | Helmet.js v7.1.0 | ✅ High |
| **Rate Limiting** | express-rate-limit v7.1.0 | ✅ High |
| **Input Validation** | express-validator v7.0.1 | ✅ High |
| **CORS Protection** | cors v2.8.5 | ✅ Medium |
| **HTTPS/TLS** | Native Node.js HTTPS | ✅ High |
| **Dependency Security** | Updated Express & body-parser | ✅ Critical |

### 1. Security Headers Configuration

The application implements comprehensive HTTP security headers via Helmet.js:

```javascript
// Security headers automatically applied
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"]
    }
  },
  crossOriginEmbedderPolicy: false // Adjust based on requirements
}));
```

**Headers Applied:**
- `Content-Security-Policy`: Prevents XSS attacks
- `X-Frame-Options`: Prevents clickjacking  
- `X-Content-Type-Options`: Prevents MIME sniffing
- `Strict-Transport-Security`: Enforces HTTPS
- `Referrer-Policy`: Controls referrer information
- `X-Powered-By`: Removed for security

### 2. Rate Limiting Configuration

Protection against DDoS and brute-force attacks:

```javascript
// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication endpoint rate limiting (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 authentication attempts per windowMs
  skipSuccessfulRequests: true
});
```

### 3. Input Validation Setup

Comprehensive request validation using express-validator:

```javascript
// Example validation middleware
const { body, validationResult } = require('express-validator');

const validateInput = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
```

### 4. CORS Policy Configuration

Secure cross-origin resource sharing:

```javascript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com', 'https://www.yourdomain.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200 // Support legacy browsers
};

app.use(cors(corsOptions));
```

## 🔒 HTTPS Configuration Guide

### Development Environment (Self-Signed Certificates)

#### Step 1: Generate Self-Signed Certificate

```bash
# Create certificates directory
mkdir -p certs

# Generate private key
openssl genrsa -out certs/key.pem 2048

# Generate certificate signing request
openssl req -new -key certs/key.pem -out certs/csr.pem

# Generate self-signed certificate
openssl x509 -req -days 365 -in certs/csr.pem -signkey certs/key.pem -out certs/cert.pem

# Clean up CSR file
rm certs/csr.pem
```

#### Step 2: Configure HTTPS Server

```javascript
const https = require('https');
const fs = require('fs');

const httpsOptions = {
  key: fs.readFileSync('certs/key.pem'),
  cert: fs.readFileSync('certs/cert.pem')
};

const httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(3443, () => {
  console.log('HTTPS Server running on port 3443');
});
```

#### Step 3: HTTP to HTTPS Redirect

```javascript
// Redirect HTTP to HTTPS
const httpApp = express();
httpApp.use((req, res) => {
  res.redirect(`https://${req.get('host')}:3443${req.url}`);
});

httpApp.listen(3000, () => {
  console.log('HTTP Server redirecting to HTTPS on port 3000');
});
```

### Production Environment (Let's Encrypt)

#### Step 1: Install Certbot

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# CentOS/RHEL
sudo yum install certbot
```

#### Step 2: Obtain SSL Certificate

```bash
# Stop your server temporarily
sudo systemctl stop your-app

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificates will be placed in:
# /etc/letsencrypt/live/yourdomain.com/
```

#### Step 3: Production HTTPS Configuration

```javascript
const httpsOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/fullchain.pem')
};
```

#### Step 4: Certificate Auto-Renewal

```bash
# Add to crontab for automatic renewal
sudo crontab -e

# Add this line to renew certificates twice daily
0 12 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload your-app"
```

## 🛡️ Security Best Practices

### Dependency Management

#### 1. Regular Security Updates

```bash
# Check for vulnerabilities
npm audit

# Fix automatically fixable vulnerabilities
npm audit fix

# Update specific vulnerable packages
npm install express@^4.20.0 body-parser@^1.20.3
```

#### 2. Dependency Monitoring

```bash
# Add audit-ci for CI/CD pipeline
npm install --save-dev audit-ci

# Package.json script
{
  "scripts": {
    "security-check": "audit-ci --moderate"
  }
}
```

### OWASP Compliance Checklist

- [x] **A01: Broken Access Control** - Implemented authentication middleware + RBAC
- [x] **A02: Cryptographic Failures** - HTTPS/TLS + secure headers enforced
- [x] **A03: Injection** - Input validation + sanitization implemented
- [x] **A04: Insecure Design** - Security-by-design architecture applied
- [x] **A05: Security Misconfiguration** - Helmet.js security headers configured
- [x] **A06: Vulnerable Components** - Dependencies updated and monitored
- [x] **A07: Authentication Failures** - Secure authentication with rate limiting
- [x] **A08: Software Integrity** - Dependency auditing and verification

### Environment-Specific Security

#### Development
```bash
# .env.development
NODE_ENV=development
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=1000
LOG_SENSITIVE_DATA=false
HTTPS_REDIRECT=false
```

#### Production
```bash
# .env.production
NODE_ENV=production
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
LOG_SENSITIVE_DATA=false
HTTPS_REDIRECT=true
TRUST_PROXY=true
```

### Security Testing

```bash
# Security test commands
npm run test:security    # Run security-specific tests
npm run test:headers     # Verify security headers
npm run test:rate-limit  # Test rate limiting
npm run test:validation  # Test input validation
```

## 📚 Documentation Navigation

### Architecture Documentation
- **[System Design](architecture/design.md)** - Comprehensive system architecture and security design patterns
- **[API Architecture](architecture/api.md)** - RESTful API design with security considerations
- **[Database Design](architecture/database.md)** - Secure data storage and access patterns

### Security Guides
- **[Security Implementation](guides/security.md)** - Detailed OWASP-compliant security hardening guide
- **[Production Deployment](guides/production.md)** - Production deployment security configurations
- **[Monitoring & Alerting](guides/monitoring.md)** - Security monitoring and incident response

### Development Guides
- **[Development Setup](guides/development.md)** - Secure development environment setup
- **[Testing Strategy](guides/testing.md)** - Security testing methodologies
- **[CI/CD Security](guides/cicd.md)** - Secure continuous integration practices

## 🔍 Security Monitoring

### Real-Time Monitoring

The application includes comprehensive security monitoring:

- **Authentication Events**: Login attempts, failures, and successful authentications
- **Rate Limit Violations**: Automated alerting for suspicious activity patterns
- **Security Header Compliance**: Verification that all security headers are present
- **Input Validation Failures**: Monitoring of malicious input attempts

### Log Analysis

```javascript
// Security event logging
const winston = require('winston');

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/security.log' })
  ]
});
```

## 🚨 Incident Response

### Security Alerts

Monitor for these critical security events:

1. **Multiple Failed Authentication Attempts**
2. **Rate Limit Threshold Exceeded**
3. **Suspicious Input Patterns**
4. **Certificate Expiration Warnings**
5. **Dependency Vulnerability Alerts**

### Response Procedures

1. **Immediate Assessment**: Identify the scope and nature of the security incident
2. **Containment**: Implement temporary blocking or rate limiting as needed
3. **Investigation**: Analyze logs and determine root cause
4. **Remediation**: Apply fixes and security patches
5. **Documentation**: Document incident and update security procedures

## 📋 Compliance Reporting

### Security Audit Reports

The system generates automated compliance reports:

- **OWASP Top 10 Compliance Report**
- **Security Header Analysis**
- **Dependency Vulnerability Assessment**
- **Rate Limiting Effectiveness Report**

### Regulatory Compliance

The security implementation supports compliance with:

- **GDPR**: Data protection and privacy controls
- **SOC 2**: Security and availability controls
- **PCI DSS**: Payment card data security (if applicable)
- **HIPAA**: Healthcare data protection (if applicable)

## 🔧 Troubleshooting

### Common Security Issues

#### HTTPS Certificate Issues
```bash
# Verify certificate validity
openssl x509 -in certs/cert.pem -text -noout

# Check certificate expiration
openssl x509 -in certs/cert.pem -noout -dates
```

#### Rate Limiting Not Working
```bash
# Verify rate limiting configuration
curl -I http://localhost:3000 # Check X-RateLimit headers
```

#### Security Headers Missing
```bash
# Test security headers
curl -I https://localhost:3443 | grep -E "(X-|Content-Security|Strict-Transport)"
```

### Support and Maintenance

For security-related issues:

1. **Check Security Logs**: Review `logs/security.log` for error details
2. **Verify Configuration**: Ensure all environment variables are properly set
3. **Update Dependencies**: Run `npm audit` and apply security updates
4. **Review Documentation**: Consult the detailed guides in the `guides/` directory

## 📖 Additional Resources

### External Security Resources

- **[OWASP Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)**
- **[Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)**
- **[Node.js Security Releases](https://nodejs.org/en/blog/vulnerability/)**
- **[Let's Encrypt Documentation](https://letsencrypt.org/docs/)**

### Community and Support

- **Issues**: Report security vulnerabilities through responsible disclosure
- **Discussions**: Join security-focused discussions in the project issues
- **Updates**: Follow security advisory notifications for timely updates

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security Disclosure

If you discover a security vulnerability, please send an email to security@example.com. All security vulnerabilities will be promptly addressed.

---

*Last Updated: $(date)*  
*Security Review Status: ✅ OWASP Compliant*  
*Next Security Audit: Quarterly*