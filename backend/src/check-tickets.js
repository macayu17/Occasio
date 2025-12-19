import prisma from './config/db.js';

async function checkTickets() {
    try {
        console.log('Fetching tickets...\n');

        const tickets = await prisma.ticket.findMany({
            take: 5,
            orderBy: { issuedAt: 'desc' },
            include: {
                order: {
                    include: {
                        registration: true
                    }
                }
            }
        });

        for (const ticket of tickets) {
            console.log('='.repeat(60));
            console.log('Ticket ID in DB:', ticket.id);

            let qrPayload;
            try {
                qrPayload = JSON.parse(ticket.qrPayload);
            } catch (e) {
                qrPayload = { error: 'Could not parse QR payload' };
            }

            console.log('Ticket ID in QR:', qrPayload.ticketId);
            console.log('IDs Match:', ticket.id === qrPayload.ticketId ? '✅ YES' : '❌ NO');
            console.log('Order ID:', ticket.orderId);
            console.log('Issued At:', ticket.issuedAt);
            console.log('');
        }

        await prisma.$disconnect();
    } catch (error) {
        console.error('Error:', error.message);
        await prisma.$disconnect();
    }
}

checkTickets();
