import { Module } from '@nestjs/common';
import { CustomersModule } from './customers/customers.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma.module';
import { StatesModule } from './customers/states/states.module';
import { MotivationModule } from './motivation/motivation.module';
import { ConfigModule } from '@nestjs/config';
import { StatisticsModule } from './customers/statistics/statistics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    StatesModule,
    MotivationModule,
    StatisticsModule,
  ],
})
export class AppModule {}
