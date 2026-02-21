import prisma from '../src/config/db.js';
import { generateTicketPDF } from '../src/services/ticket.service.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const orders = await prisma.order.findMany({
    where: { status: 'PAID' },
    include: { registration: { include: { event: true } } },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${orders.length} paid orders`);

  let processed = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would regenerate ticket for order ${order.id}`);
      } else {
        const ticket = await generateTicketPDF(order);
        console.log(`Regenerated ticket ${ticket.id} for order ${order.id} -> ${ticket.ticketPdfUrl}`);
      }
      processed += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed order ${order.id}:`, error.message);
    }
  }

  console.log(`Done. Processed: ${processed}, Failed: ${failed}, DryRun: ${dryRun}`);
}

main()
  .catch((error) => {
    console.error('Backfill tickets failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
