const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const doc = '39420407000103';
  const c1 = await prisma.client.findFirst({ where: { doc } });
  console.log('Direct exact match:', c1);

  const c2 = await prisma.client.findFirst({
    where: { doc: { contains: doc } }
  });
  console.log('Contains match:', c2);
}
main().finally(() => prisma.$disconnect());