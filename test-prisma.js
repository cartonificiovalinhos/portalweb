const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const items = await prisma.clientItem.findMany({ take: 5 });
  console.log('ClientItems:', items);
}
main().catch(console.error).finally(() => prisma.$disconnect());
