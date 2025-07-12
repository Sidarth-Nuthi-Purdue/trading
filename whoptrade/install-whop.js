// Run this to install Whop SDK: node install-whop.js
const { execSync } = require('child_process');

try {
  console.log('Installing @whop/api...');
  execSync('npm install @whop/api', { stdio: 'inherit' });
  console.log('Successfully installed @whop/api');
} catch (error) {
  console.error('Failed to install @whop/api:', error.message);
}