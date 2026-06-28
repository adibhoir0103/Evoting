const { execSync } = require('child_process');

try {
  console.log('Attempting to baseline the database (resolving 0_init)...');
  // This will succeed only once on a DB that has no migrations table yet.
  // If it already has migrations, or the migration is already resolved, this fails silently.
  execSync('npx prisma migrate resolve --applied 0_init', { stdio: 'ignore' });
  console.log('Baseline resolved successfully.');
} catch (e) {
  console.log('Baseline already applied or not needed.');
}

try {
  console.log('Deploying migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
} catch (e) {
  console.error('Migration failed!');
  process.exit(1);
}
