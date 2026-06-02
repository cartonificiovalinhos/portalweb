import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = Number((session.user as any).id);

    // Get clients linked to user
    const clientReps = await prisma.userClientRep.findMany({
        where: { userId },
        select: { clientId: true }
    });
    const clientIds = clientReps.map(r => r.clientId);

    if (clientIds.length === 0) {
        return NextResponse.json([]);
    }

    // Find clients with cart items
    const clientsWithCarts = await prisma.client.findMany({
        where: {
            id: { in: clientIds },
            cartItems: { some: {} } // Only clients with items
        },
        include: {
            cartItems: {
                include: { inventoryItem: true }
            }
        }
    });

    return NextResponse.json(clientsWithCarts);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = Number((session.user as any).id);

    const clientReps = await prisma.userClientRep.findMany({
      where: { userId },
      select: { clientId: true }
    });
    const clientIds = clientReps.map(r => r.clientId);
    if (clientIds.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

    const result = await prisma.clientCartItem.deleteMany({
      where: { clientId: { in: clientIds } }
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
