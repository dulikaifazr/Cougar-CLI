#!/usr/bin/env node
  
// Cross-platform CLI wrapper for cougar
// Prefers Bun but falls back to Node.js with tsx loader

const { spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

// Get the directory where this CLI script is installed
const cougarDir = __dirname;
const distPath = path.join(cougarDir, 'dist', 'index.js');

// Check if we have a built version
if (!existsSync(distPath)) {
  console.error('❌ Built files not found. Run "bun run build" first.');
  process.exit(1);
}

// Try to use Bun first, then fallback to Node.js with tsx
const runWithBun = () => {
  const proc = spawn('bun', ['run', distPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: process.cwd()  // Use current working directory, not cougar installation directory
  });

  proc.on('error', (err) => {
    if (err.code === 'ENOENT') {
      // Bun not found, try Node.js
      runWithNode();
    } else {
      console.error('❌ Failed to start with Bun:', err.message);
      process.exit(1);
    }
  });

  proc.on('close', (code) => {
    process.exit(code);
  });
};

const runWithNode = () => {
  const proc = spawn('node', [distPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: process.cwd()  // Use current working directory, not cougar installation directory
  });

  proc.on('error', (err) => {
    console.error('❌ Failed to start with Node.js:', err.message);
    process.exit(1);
  });

  proc.on('close', (code) => {
    process.exit(code);
  });
};

// Start with Bun preference
runWithBun();
