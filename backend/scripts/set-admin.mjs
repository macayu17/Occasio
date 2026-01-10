// Script to check users and events, and set admin role
// Run with: node scripts/set-admin.mjs

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const targetEmail = 'anayush1406@gmail.com';

    console.log('\n=== Users in Database ===');
    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true }
    });
    users.forEach(u => console.log(`- ${u.email} (${u.role}) ID: ${u.id}`));

    console.log('\n=== Events in Database ===');
    const events = await prisma.event.findMany({
        select: {
            id: true,
            title: true,
            organizerId: true,
            organizer: { select: { email: true } }
        }
    });
    events.forEach(e => console.log(`- "${e.title}" by ${e.organizer?.email} (organizerId: ${e.organizerId})`));

    // Find and update target user to ADMIN
    console.log(`\n=== Setting ${targetEmail} as ADMIN ===`);
    const targetUser = await prisma.user.findUnique({
        where: { email: targetEmail }
    });

    if (targetUser) {
        await prisma.user.update({
            where: { email: targetEmail },
            data: { role: 'ADMIN' }
        });
        console.log(`✅ Updated ${targetEmail} to ADMIN role`);
    } else {
        console.log(`❌ User ${targetEmail} not found in database`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
