#!/bin/bash
# Commit script for README.md updates

# Add the modified README.md file
git add README.md

# Commit with descriptive message
git commit -m "Updated README.md with comprehensive Node.js security configuration instructions

- Added security setup guide including HTTPS configuration and certificate generation
- Included rate limiting, CORS, and input validation guidelines  
- Documented security best practices for Node.js/Express.js
- Integrated Node.js security stack with existing Java test automation framework
- Added comprehensive security checklist and dual-stack architecture documentation

Addresses vulnerability mitigation requirements per security analysis."

echo "README.md changes committed successfully"