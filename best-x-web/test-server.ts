console.log('Testing server startup...');

try {
  require('./server.ts');
  console.log('Server module loaded');
} catch (error) {
  console.error('Error loading server:', error);
}