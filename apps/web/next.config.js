const path = require('path');
const fs = require('fs');

// Next.js only auto-loads env files from this app's folder, but this monorepo
// keeps a single `.env` at the repo root (shared with the API). Load it here so
// NEXT_PUBLIC_* values (e.g. the SUMIT public keys) reach the browser bundle.
// Existing process.env values win, so real env vars / CI overrides are kept.
function loadRootEnv() {
  const rootEnv = path.join(__dirname, '../../.env');
  if (!fs.existsSync(rootEnv)) return;
  for (const rawLine of fs.readFileSync(rootEnv, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadRootEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

module.exports = async () => {
  const { default: withSerwist } = await import('@serwist/next');
  return withSerwist({
    swSrc: 'src/app/sw.ts',
    swDest: 'public/sw.js',
    reloadOnOnline: true,
    disable: process.env.NODE_ENV === 'development',
  })(nextConfig);
};
