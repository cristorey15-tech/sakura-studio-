#!/usr/bin/env node
/**
 * Database Migration Helper
 * 
 * Usage:
 *   node scripts/db-migrate.js dev      — Create migration + apply (development)
 *   node scripts/db-migrate.js deploy   — Apply pending migrations (production/Vercel)
 *   node scripts/db-migrate.js status   — Show migration status
 * 
 * This replaces `prisma db push` with versioned migrations for consistency.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const command = process.argv[2] || 'status';

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    if (output.trim()) console.log(output.trim());
    return output;
  } catch (err) {
    if (err.stderr) console.error(err.stderr);
    throw err;
  }
}

function checkMigrationDir() {
  const migrationDir = path.join(__dirname, '..', 'prisma', 'migrations');
  return fs.existsSync(migrationDir);
}

switch (command) {
  case 'dev': {
    console.log('🔄 Creating development migration...\n');
    // Generate client first
    run('npx prisma generate');
    // Create migration with descriptive name
    const name = process.argv[3] || `migration-${Date.now()}`;
    run(`npx prisma migrate dev --name ${name} --create-only`);
    console.log('\n✅ Migration created. Review the SQL in prisma/migrations/, then run:');
    console.log('   node scripts/db-migrate.js dev apply');
    break;
  }

  case 'dev:apply': {
    console.log('🔄 Applying latest migration...');
    run('npx prisma migrate dev');
    console.log('\n✅ Migration applied successfully.');
    break;
  }

  case 'deploy': {
    console.log('🔄 Applying pending migrations (production)...');
    run('npx prisma generate');
    run('npx prisma migrate deploy');
    console.log('\n✅ Migrations deployed successfully.');
    break;
  }

  case 'status': {
    console.log('📊 Migration Status\n');
    if (!checkMigrationDir()) {
      console.log('No migrations directory found. Run initial migration:');
      console.log('  npx prisma migrate dev --name init');
    } else {
      run('npx prisma migrate status');
    }
    break;
  }

  case 'reset': {
    console.log('⚠️  This will reset the database. Are you sure?');
    console.log('Run with: node scripts/db-migrate.js reset --confirm');
    if (process.argv[3] !== '--confirm') {
      console.log('Aborted. Add --confirm to proceed.');
      break;
    }
    run('npx prisma migrate reset --force');
    console.log('\n✅ Database reset successfully.');
    break;
  }

  default:
    console.log('Usage: node scripts/db-migrate.js [dev|dev:apply|deploy|status|reset]');
    process.exit(1);
}
