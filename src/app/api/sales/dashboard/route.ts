import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? Number((session.user as any).id) : null;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get('year') || new Date().getFullYear());
    const month = searchParams.get('month'); // "1" to "12" or null for all
    const entityIdParam = searchParams.get('entityId');

    // Base filter for orders
    const whereClause: any = {
      createdById: userId,
      orderDate: {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      },
    };

    if (month) {
        const m = Number(month) - 1;
        whereClause.orderDate = {
            gte: new Date(year, m, 1),
            lt: new Date(year, m + 1, 1),
        };
    }

    if (entityIdParam) {
        whereClause.entityId = Number(entityIdParam);
    }

    // Fetch user's allowed entities for filter
    const userEntitiesRaw = await prisma.userEntity.findMany({
        where: { userId },
        include: { entity: true }
    });
    const availableEntities = userEntitiesRaw.map(ue => ({
        id: ue.entity.id,
        name: ue.entity.name
    }));

    // 1. Sales by Customer (Top 10)
    const salesByCustomerRaw = await prisma.salesOrder.groupBy({
        by: ['customerName'],
        where: whereClause,
        _sum: {
            total: true
        },
        orderBy: {
            _sum: {
                total: 'desc'
            }
        },
        take: 10
    });

    const salesByCustomer = salesByCustomerRaw.map(item => ({
        name: item.customerName,
        value: item._sum.total || 0
    }));

    // 2. Sales by Status
    const salesByStatusRaw = await prisma.salesOrder.groupBy({
        by: ['status'],
        where: whereClause,
        _sum: {
            total: true
        }
    });

    const statusTranslation: Record<string, string> = {
        'OPEN': 'Orçamento',
        'EM APROVAÇÃO COMERCIAL': 'Em Aprovação Comercial',
        'EM APROVACAO COMERCIAL': 'Em Aprovação Comercial',
        'AGUARDANDO INTEGRAÇÃO': 'Aguardando Integração',
        'ERRO NA INTEGRAÇÃO': 'Erro na integração',
        'INTEGRADO': 'Integrado',
        'EM FILA PRODUÇÃO': 'Em fila produção',
        'EM PRODUÇÃO': 'Em produção',
        'PRODUZIDO/ESTOCADO': 'Produzido/Estocado',
        'FATURADO': 'Faturado',
        'CANCELADO': 'Cancelado'
    };

    const statusMap = new Map<string, number>();

    salesByStatusRaw.forEach(item => {
        const label = statusTranslation[item.status?.toUpperCase()] || item.status;
        const current = statusMap.get(label) || 0;
        statusMap.set(label, current + (item._sum.total || 0));
    });

    const salesByStatus = Array.from(statusMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // 3. Sales by Commercial Family
    // This requires a more complex query because of relations. groupBy on SalesOrderItem is limited on relations.
    // We will fetch items and aggregate in memory or use raw query if performance is needed.
    // Given the scope, fetching items for the user's orders in the period is safer for Prisma without raw queries.
    
    const orders = await prisma.salesOrder.findMany({
        where: whereClause,
        select: {
            id: true,
            items: {
                select: {
                    lineTotal: true,
                    inventoryItem: {
                        select: {
                            commercialFamily: {
                                select: {
                                    description: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const familyMap = new Map<string, number>();
    
    orders.forEach(order => {
        order.items.forEach(item => {
            const family = item.inventoryItem?.commercialFamily?.description || 'Outros';
            const current = familyMap.get(family) || 0;
            familyMap.set(family, current + (item.lineTotal || 0));
        });
    });

    const salesByFamily = Array.from(familyMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // 4. Sales Trend (Monthly) - Sales vs Invoiced
    // We want to compare "Total Sales (Integrated+)" vs "Total Invoiced"
    // Statuses considered "Integrated or later": NOT (OPEN, AGUARDANDO, ERRO, CANCELADO)
    const excludedStatuses = ['OPEN', 'AGUARDANDO INTEGRAÇÃO', 'ERRO NA INTEGRAÇÃO', 'CANCELADO'];
    
    const trendWhere = {
        ...whereClause,
        status: { notIn: excludedStatuses },
        // Always show full year trend
        orderDate: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
        }
    };

    const trendOrders = await prisma.salesOrder.findMany({
        where: trendWhere,
        select: {
            orderDate: true,
            total: true,
            totalInvoiced: true
        }
    });

    const monthlyData = new Array(12).fill(0).map(() => ({ sales: 0, invoiced: 0 }));
    
    trendOrders.forEach(order => {
        const d = new Date(order.orderDate);
        const m = d.getMonth(); // 0-11
        if (m >= 0 && m < 12) {
            monthlyData[m].sales += (order.total || 0);
            monthlyData[m].invoiced += (order.totalInvoiced || 0);
        }
    });

    const monthsLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const trend = monthsLabels.map((m, i) => ({
        name: m,
        sales: monthlyData[i].sales,
        invoiced: monthlyData[i].invoiced
    }));

    return NextResponse.json({
        salesByCustomer,
        salesByStatus,
        salesByFamily,
        trend,
        availableEntities
    });

  } catch (err: any) {
    console.error('Dashboard API Error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
