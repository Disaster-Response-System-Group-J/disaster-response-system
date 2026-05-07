#!/usr/bin/env node
const { spawnSync } = require('child_process');

// Filter out flags that Vitest doesn't understand (common Jest/CI flags)
const filtered = process.argv.slice(2).filter(arg => {
  if (arg.startsWith('--watchAll')) return false;
  if (arg === '--watchAll=false' || arg === '--watchAll=true') return false;
  return true;
});

// Prefer local vitest if available
const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['vitest', 'run', ...filtered];

const res = spawnSync(cmd, args, { stdio: 'inherit' });
process.exit(res.status || 0);
