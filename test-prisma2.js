const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const order = await prisma.salesOrder.findUnique({
    where: { id: 23 },
    include: {
      entity: true,
      items: {
        include: {
          inventoryItem: { include: { commercialFamily: true } }
        }
      }
    }
  });
  console.log('Order:', order);
}
main().catch(console.error).finally(() => prisma.$disconnect());
