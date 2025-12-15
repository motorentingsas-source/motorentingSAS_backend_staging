import { Injectable, NotFoundException } from '@nestjs/common';
import { StatisticsDto } from '../dto/statistics-customer.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getStatistics(dto: StatisticsDto) {
    const { advisors, status, startDate, endDate } = dto;

    const state = await this.prisma.state.findUnique({ where: { id: status } });
    if (!state) throw new NotFoundException(`El estado ${status} no existe`);

    // Filtro por fechas
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Traer clientes filtrados
    const customers = await this.prisma.customer.findMany({
      where: {
        advisorId: { in: advisors },
        stateId: state.id,
        AND: Object.keys(dateFilter).length ? [{ createdAt: dateFilter }] : [],
      },
    });

    // Traer solo asesores que nos interesan
    const users = await this.prisma.user.findMany({
      where: { id: { in: advisors } },
    });

    return advisors.map((advisorId) => {
      const advisor = users.find((u) => u.id === advisorId);
      const advisorName = advisor?.name || `Asesor ${advisorId}`;
      const quantity = customers.filter(
        (c) => c.advisorId === advisorId,
      ).length;

      return { name: advisorName, quantity };
    });
  }
}
