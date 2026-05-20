const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, state_code: true, constituency_code: true }});
  const states = await prisma.state.findMany({ select: { code: true }});
  const stateCodes = new Set(states.map(s => s.code));
  
  for (const u of users) {
    if (!stateCodes.has(u.state_code)) {
      console.log(`User ${u.id} has invalid state_code: ${u.state_code}`);
      await prisma.user.update({ where: { id: u.id }, data: { state_code: 0 }});
    }
  }

  const candidates = await prisma.electionCandidate.findMany({ select: { id: true, state_code: true, constituency_code: true }});
  for (const c of candidates) {
    if (!stateCodes.has(c.state_code)) {
      console.log(`Candidate ${c.id} has invalid state_code: ${c.state_code}`);
      await prisma.electionCandidate.update({ where: { id: c.id }, data: { state_code: 0 }});
    }
  }
  console.log("Cleanup done.");
}

main().finally(() => prisma.$disconnect());
