console.log('Test file running...');
console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);

try {
  const db = require('./lib/db');
  console.log('DB module loaded successfully');
} catch (error) {
  console.error('Error loading DB:', error);
}