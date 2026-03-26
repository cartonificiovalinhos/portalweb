const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const items = await prisma.clientItem.findMany({
    where: { clientId: 345, allowed: true },
    include: { inventoryItem: { include: { commercialFamily: true } } }
  });
  console.log('Count:', items.length);
  if (items.length > 0) console.log('First:', items[0].inventoryItem.name);
}
main().catch(console.error).finally(() => prisma.$disconnect());
