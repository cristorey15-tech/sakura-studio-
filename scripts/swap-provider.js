/**
 * swap-provider.js
 * 
 * Swaps the Prisma schema provider between "sqlite" and "postgresql".
 * Used by Vercel postinstall to ensure the schema matches the deployment target.
 * 
 * Usage:
 *   node scripts/swap-provider.js postgresql  (for Vercel builds)
 *   node scripts/swap-provider.js sqlite       (for local dev)
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const targetProvider = process.argv[2];

if (!targetProvider || !['sqlite', 'postgresql'].includes(targetProvider)) {
  console.error('Usage: node scripts/swap-provider.js <sqlite|postgresql>');
  process.exit(1);
}

let schema = fs.readFileSync(schemaPath, 'utf-8');

// Replace the provider line in the datasource block
schema = schema.replace(
  /provider\s*=\s*"(?:sqlite|postgresql)"/,
  `provider = "${targetProvider}"`
);

// Update the DATABASE_URL if switching to postgresql for Vercel
if (targetProvider === 'postgresql') {
  // On Vercel, DATABASE_URL env var will be set to the PostgreSQL connection string
  // The schema just needs the provider to match
  console.log(`✅ Provider set to "${targetProvider}" for deployment.`);
} else {
  console.log(`✅ Provider set to "${targetProvider}" for local development.`);
}

fs.writeFileSync(schemaPath, schema, 'utf-8');
console.log(`   Updated: ${schemaPath}`);
