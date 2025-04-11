/**
 * Debug Mode Verification Script
 * 
 * This script checks if debug mode is properly configured and enabled.
 * Run with: node scripts/check-debug.js
 */

// Check environment variables
const isDebugEnabled = process.env.DEBUG === 'true';
const nodeEnv = process.env.NODE_ENV || 'production';
const isVercel = !!process.env.VERCEL;
const vercelEnv = process.env.VERCEL_ENV || 'unknown';

console.log('========= DEBUG MODE CHECK =========');
console.log('Debug Mode:', isDebugEnabled ? '✅ ENABLED' : '❌ DISABLED');
console.log('Node Environment:', nodeEnv);
console.log('Running on Vercel:', isVercel ? '✅ YES' : '❌ NO');
if (isVercel) {
  console.log('Vercel Environment:', vercelEnv);
}
console.log('===================================');

// Load and check vercel.json
const fs = require('fs');
const path = require('path');

try {
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  
  console.log('\n========= VERCEL CONFIG CHECK =========');
  
  if (vercelConfig.env) {
    console.log('Debug in vercel.json:', vercelConfig.env.DEBUG === 'true' ? '✅ ENABLED' : '❌ DISABLED');
    console.log('Node Env in vercel.json:', vercelConfig.env.NODE_ENV || 'not set');
  } else {
    console.log('❌ No env section found in vercel.json');
  }
  
  console.log('======================================');
} catch (error) {
  console.error('\n❌ Error reading vercel.json:', error.message);
}

// Check for debug utility
try {
  const debugExists = fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'debug.ts'));
  
  console.log('\n========= DEBUG UTILITY CHECK =========');
  console.log('Debug utility file:', debugExists ? '✅ EXISTS' : '❌ MISSING');
  console.log('======================================');
} catch (error) {
  console.error('\n❌ Error checking debug utility:', error.message);
}

// Provide recommendations
console.log('\n========= RECOMMENDATIONS =========');

if (!isDebugEnabled) {
  console.log('❗ Set DEBUG=true in your .env.local file or Vercel environment variables');
}

if (nodeEnv !== 'development' && isDebugEnabled) {
  console.log('⚠️ Debug mode is enabled but NODE_ENV is not development');
  console.log('   This may lead to unexpected behavior');
}

if (isVercel && !vercelConfig?.env?.DEBUG) {
  console.log('❗ Add DEBUG=true to the env section in vercel.json for Vercel deployments');
}

console.log('===================================');