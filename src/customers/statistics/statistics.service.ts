import { Injectable, NotFoundException } from '@nestjs/common';
import { StatisticsDto } from '../dto/statistics-customer.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getStatistics(dto: StatisticsDto) {
    const { advisors, status, startDate, endDate } = dto;

    const state = await this.prisma.state.findUnique({
      where: { id: status },
    });

    if (!state) {
      throw new NotFoundException(`El estado ${status} no existe en DB`);
    }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const customers = await this.prisma.customer.findMany({
      where: {
        advisorId: { in: advisors },
        stateId: state.id,
        createdAt: Object.keys(dateFilter).length ? dateFilter : undefined,
      },
      include: {
        advisor: true,
      },
    });

    const users = await this.prisma.user.findMany({});

    return advisors.map((advisorId) => {
      const advisor = users.filter((c) => c.id === advisorId);
      const list = customers.filter((c) => c.advisorId === advisorId);
      const advisorName = advisor[0]?.name || `Asesor ${advisorId}`;

      return {
        name: advisorName,
        quantity: list.length,
      };
    });
  }
}
