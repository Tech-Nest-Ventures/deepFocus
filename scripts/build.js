#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building with Vite...\n');

try {
  // Build main process
  console.log('📦 Building main process...');
  execSync('npx vite build --config vite.main.config.ts', { stdio: 'inherit' });
  
  // Build preload
  console.log('\n📦 Building preload...');
  execSync('npx vite build --config vite.preload.config.ts', { stdio: 'inherit' });
  
  // Build renderer
  console.log('\n📦 Building renderer...');
  execSync('npx vite build --config vite.renderer.config.mts', { stdio: 'inherit' });
  
  console.log('\n✅ Vite builds completed!\n');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

