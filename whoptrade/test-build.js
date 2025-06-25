console.log('Testing build...');

// Simple test script to check if we can run Node.js
const fs = require('fs');
const path = require('path');

console.log('Current directory:', process.cwd());
console.log('Package.json exists:', fs.existsSync('package.json'));

if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log('Project name:', pkg.name);
  console.log('Next.js version:', pkg.dependencies?.next);
  console.log('React version:', pkg.dependencies?.react);
}