const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeDoc(doc) {
  return (doc || '').replace(/\D+/g, '');
}

async function test(userId, customerDoc) {
  try {
    const doc = normalizeDoc(String(customerDoc || ''));
    console.log('Doc:', doc);
    const link = await prisma.userClientRep.findFirst({
      where: { userId, client: { is: { doc } } },
      select: { id: true }
    });
    console.log('Link:', link);
  } catch (e) {
    console.error('Error:', e);
  }
}

async function main() {
  await test(32, '39420407000103');
}

main().catch(console.error).finally(() => prisma.$disconnect());
