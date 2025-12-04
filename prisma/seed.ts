import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const stateCustomer = [
  'Sin Contactar',
  'INTENTANDO CONTACTAR',
  'REPORTADO',
  'INTERESADO',
  'NO INTERESADO',
  'CREDIORBE',
  'PROGRESER',
  'SUFI',
  'VANTI',
  'MOTORENTING',
  'MOTORENTING PLUS',
  'BBVA',
  'CAJA SOCIAL',
  'NU BANK',
  'ADDI',
  'BANCO BOGOTÁ',
  'VEHIGRUPO',
  'APROBADO OTROS',
  'VENTA',
  'FUERA DE CUNDINAMARCA',
];

async function main() {
  // 1. Insertar estados
  for (const name of stateCustomer) {
    await prisma.state.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 2. Crear Admin inicial
  const passwordHash = await bcrypt.hash('Yorki9316*', 10);

  await prisma.user.upsert({
    where: { email: 'MOTORENTING.COLOMBIA.SAS@GMAIL.COM' },
    update: {},
    create: {
      name: 'Yordi Diaz',
      email: 'MOTORENTING.COLOMBIA.SAS@GMAIL.COM',
      password: passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  console.log('Seed completado: Estados + Admin');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
