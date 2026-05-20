const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.state.upsert({
    where: { code: 0 },
    update: {},
    create: { code: 0, name: 'Default State' }
  });
  
  await prisma.constituency.upsert({
    where: { code: 0 },
    update: {},
    create: { code: 0, state_code: 0, name: 'Default Constituency' }
  });
  
  console.log('Seeded State 0 and Constituency 0');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
