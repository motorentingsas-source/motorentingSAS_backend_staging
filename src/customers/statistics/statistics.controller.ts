import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { StatisticsDto } from '../dto/statistics-customer.dto';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';

@Controller('statistics')
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private statsService: StatisticsService) {}

  @Post()
  getStats(@Body() dto: StatisticsDto) {
    return this.statsService.getStatistics(dto);
  }
}
