// Shared Prisma Client Singleton
// Prevents multiple PrismaClient instances from exhausting the connection pool
// on resource-constrained hosts like Render free tier (9 connections max).

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
    log: process.env.NODE_ENV === 'production'
        ? ['error']
        : ['query', 'error', 'warn'],
});

// Graceful shutdown — release connections on process exit
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

module.exports = prisma;
