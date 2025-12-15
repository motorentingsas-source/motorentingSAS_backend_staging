import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Role, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AssignMultipleDto } from './dto/assign-multiple.dto';
import { hasRole } from 'src/common/role-check.util';
import { Workbook } from 'exceljs';
import { ApproveCustomerDto } from './dto/approve-customer.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { CreateCustomerInvoiceDto } from './dto/create-customer-invoice.dto';
import { CreateCustomerRegistrationDto } from './dto/create-customer-registration.dto';
import { text } from 'pdfkit/js/mixins/text';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  // Obtener clientes según rol (activos, excluye entregados)
  async getCustomers(user: any) {
    const baseWhere: any = {
      NOT: {
        AND: [{ stateId: 19 }, { plateNumber: { not: null } }],
      },
    };

    const isHighRole = hasRole(user.role, [
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.COORDINADOR,
    ]);

    const excludeStatesForAdvisor = [
      'NO INTERESADO',
      'REPORTADO',
      'FUERA DE CUNDINAMARCA',
    ];

    const whereClause = isHighRole
      ? baseWhere
      : {
          ...baseWhere,
          advisorId: user.userId,
          state: {
            name: { notIn: excludeStatesForAdvisor },
          },
        };

    const orderBy = isHighRole
      ? [{ updatedAt: 'desc' as const }, { createdAt: 'desc' as const }]
      : [
          { assignedAt: 'desc' as const },
          { createdAt: 'desc' as const },
          { updatedAt: 'desc' as const },
        ];

    const customers = await this.prisma.customer.findMany({
      where: whereClause,
      include: {
        advisor: true,
        comments: {
          include: { createdBy: true },
          orderBy: { createdAt: 'desc' as const },
        },
        state: true,
      },
      orderBy,
    });

    if (isHighRole) {
      return {
        success: true,
        message: 'Clientes obtenidos correctamente',
        data: customers,
      };
    }

    const sinContactar = customers
      .filter((c) => c.state?.name === 'Sin Contactar')
      .sort((a, b) => {
        const dateA = a.assignedAt ? new Date(a.assignedAt).getTime() : 0;
        const dateB = b.assignedAt ? new Date(b.assignedAt).getTime() : 0;
        return dateB - dateA;
      });

    const otros = customers
      .filter((c) => c.state?.name !== 'Sin Contactar')
      .sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });

    const orderedCustomers = [...sinContactar, ...otros];

    return {
      success: true,
      message: 'Clientes obtenidos correctamente',
      data: orderedCustomers,
    };
  }

  // Obtener clientes entregados/finalizados
  async getDeliveredCustomers(user: any) {
    const baseWhere: any = {
      stateId: 19,
      plateNumber: { not: null },
    };

    const customers = hasRole(user.role, [
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.COORDINADOR,
    ])
      ? await this.prisma.customer.findMany({
          where: baseWhere,
          include: {
            advisor: true,
            comments: {
              include: { createdBy: true },
              orderBy: { createdAt: 'desc' },
            },
            holders: true,
            purchase: true,
            payments: true,
            receipts: true,
            invoices: true,
            registration: true,
            state: true,
          },
          orderBy: { updatedAt: 'desc' },
        })
      : await this.prisma.customer.findMany({
          where: { ...baseWhere, advisorId: user.userId },
          include: {
            advisor: true,
            comments: {
              include: { createdBy: true },
              orderBy: { createdAt: 'desc' },
            },
            state: true,
          },
          orderBy: { updatedAt: 'desc' },
        });

    return {
      success: true,
      message: 'Clientes entregados obtenidos correctamente',
      data: customers,
    };
  }

  // Obtener cliente por ID
  async getCustomerById(id: number, user: any) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        advisor: true,
        state: true,
        comments: {
          include: { createdBy: true },
          orderBy: { createdAt: 'desc' },
        },
        invoices: true,
        registration: true,
        payments: true,
        receipts: true,
        holders: true,
        purchase: true,
      },
    });

    if (!customer) throw new NotFoundException('Cliente no encontrado');

    if (user.role === Role.ASESOR && customer.advisorId !== user.userId) {
      throw new ForbiddenException('No tienes permiso para ver este cliente');
    }

    const hasInvoice = customer.invoices.length > 0;
    const hasRegistration = customer.registration.length > 0;

    const { outstandingBalance, creditBalance } =
      this.calculateOutstandingBalance(customer);

    const isReadyForProcess =
      hasInvoice && hasRegistration && outstandingBalance === 0;

    return {
      success: true,
      message: 'Cliente obtenido correctamente',
      data: {
        ...customer,
        birthdate: formatDate(customer.birthdate),
        saleDate: formatDate(customer.saleDate),
        deliveryDate: formatDate(customer.deliveryDate),
        outstandingBalance,
        creditBalance,
        isReadyForProcess,
      },
    };
  }

  async getSaleCustomers(user: any) {
    const SALE_STATE_ID = 19;

    if (hasRole(user.role, [Role.ASESOR])) {
      throw new ForbiddenException(
        'No tienes permisos para ver clientes en estado de venta',
      );
    }

    const customers = await this.prisma.customer.findMany({
      where: {
        stateId: SALE_STATE_ID,

        saleState: {
          in: ['PENDIENTE_POR_APROBAR', 'RECHAZADO'],
        },

        deliveryState: {
          not: 'ENTREGADO',
        },
      },
      include: {
        advisor: true,
        comments: {
          include: { createdBy: true },
          orderBy: { createdAt: 'desc' },
        },
        state: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      success: true,
      message: 'Clientes en estado Venta obtenidos correctamente',
      data: customers,
    };
  }

  // Crear cliente
  async createCustomer(dto: CreateCustomerDto, user: any) {
    if (!dto.advisorId || isNaN(dto.advisorId) || dto.advisorId === 0) {
      dto.advisorId = null;
    }

    const existing = await this.prisma.customer.findFirst({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException(
        `El cliente con email ${dto.email} ya existe`,
      );
    }

    let advisorId: number | null | undefined = dto.advisorId;
    let assignedAt: Date | null = null;

    if (hasRole(user.role, [Role.ASESOR])) {
      advisorId = user.userId;
      assignedAt = null;
    } else if (
      hasRole(user.role, [Role.SUPER_ADMIN, Role.ADMIN, Role.COORDINADOR]) &&
      dto.advisorId
    ) {
      assignedAt = new Date();
    }

    const birthdate = new Date(dto.birthdate);

    let stateId = dto.stateId;
    if (!stateId) {
      const defaultState = await this.prisma.state.findUnique({
        where: { name: 'Sin Contactar' },
      });
      stateId = defaultState?.id;
    }

    const customer = await this.prisma.customer.create({
      data: {
        ...dto,
        birthdate,
        advisorId,
        stateId,
        assignedAt,
        saleState: dto.saleState ?? 'NA',
        origin: dto.origin ?? 'CRM',
        orderNumber: dto.orderNumber ?? null,
        distributor: dto.distributor ?? null,
      },
      include: {
        advisor: { select: { id: true, email: true } },
        state: true,
      },
    });

    return {
      success: true,
      message: 'Cliente creado exitosamente',
      data: customer,
    };
  }

  // Actualizar cliente
  async updateCustomer(id: number, dto: UpdateCustomerDto, user: any) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    if (dto.birthdate) dto.birthdate = new Date(dto.birthdate as any) as any;
    if (dto.saleDate) dto.saleDate = new Date(dto.saleDate as any) as any;
    if (dto.deliveryDate)
      dto.deliveryDate = new Date(dto.deliveryDate as any) as any;
    if (dto.approvalDate)
      dto.approvalDate = new Date(dto.approvalDate as any) as any;

    const isChangingDeliveryState =
      dto.deliveryState && dto.deliveryState !== customer.deliveryState;

    if (isChangingDeliveryState && dto.deliveryState === 'ENTREGADO') {
      dto.saleState = customer.saleState;
    } else if (
      isChangingDeliveryState &&
      'PENDIENTE_ENTREGA' === dto.deliveryState
    ) {
      dto.saleState = 'PENDIENTE_POR_APROBAR';
    } else if (dto.stateId === 19) {
      dto.saleState = 'PENDIENTE_POR_APROBAR';
    } else {
      dto.saleState = dto.saleState ?? customer.saleState;
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
      },
      include: {
        advisor: true,
        state: true,
        comments: { include: { createdBy: true } },
      },
    });

    return {
      success: true,
      message: 'Cliente actualizado con éxito',
      data: updated,
    };
  }

  // Eliminar cliente
  async deleteCustomer(id: number, user: any) {
    if (!hasRole(user.role, [Role.SUPER_ADMIN]))
      throw new ForbiddenException('No tienes permisos');

    await this.prisma.customer.delete({ where: { id } });

    return { success: true, message: 'Cliente eliminado correctamente' };
  }

  // Agregar comentario
  async addComment(
    customerId: number,
    description: string,
    saleState: string | undefined,
    user: any,
  ) {
    const canChangeSaleState = hasRole(user.role, [
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.COORDINADOR,
    ]);

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const comment = await this.prisma.comment.create({
      data: {
        description,
        customerId,
        createdById: user.userId,
      },
      include: { createdBy: true },
    });

    const updateData: any = { updatedAt: new Date() };

    if (saleState === 'RECHAZADO' && canChangeSaleState) {
      updateData.saleState = 'RECHAZADO';
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: updateData,
    });

    return {
      success: true,
      message: 'Comentario agregado correctamente',
      data: comment,
    };
  }

  // Reasignar cliente a un asesor
  async assignAdvisor(customerId: number, advisorId: number, user: any) {
    if (!hasRole(user.role, [Role.SUPER_ADMIN, Role.ADMIN, Role.COORDINADOR]))
      throw new ForbiddenException('No tienes permisos');

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: { advisorId, assignedAt: new Date() },
      include: { advisor: true, state: true },
    });

    return { success: true, message: 'Cliente reasignado', data: updated };
  }

  // Reasignar múltiples clientes
  async assignMultipleCustomers(dto: AssignMultipleDto, user: any) {
    if (!hasRole(user.role, [Role.SUPER_ADMIN, Role.ADMIN, Role.COORDINADOR]))
      throw new ForbiddenException('No tienes permisos');

    const { customerIds, advisorId } = dto;

    const result = await this.prisma.customer.updateMany({
      where: { id: { in: customerIds } },
      data: { advisorId, assignedAt: new Date() },
    });

    return {
      success: true,
      message: `${result.count} clientes reasignados al asesor ${advisorId}`,
      data: result,
    };
  }

  // Importar clientes desde Excel (solo SUPER_ADMIN, ADMIN Y COORDINADOR)
  async importCustomers(file: Express.Multer.File, user: any) {
    if (!hasRole(user.role, [Role.SUPER_ADMIN, Role.ADMIN, Role.COORDINADOR])) {
      throw new ForbiddenException('No tienes permisos para importar clientes');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      throw new BadRequestException('El archivo está vacío o mal formateado');
    }

    const defaultState = await this.prisma.state.findUnique({
      where: { name: 'Sin Contactar' },
    });

    if (!defaultState) {
      throw new NotFoundException(
        'No se encontró el estado por defecto "Sin Contactar"',
      );
    }

    // Columnas válidas según tu modelo
    const validColumns = [
      'name',
      'email',
      'phone',
      'address',
      'city',
      'department',
      'document',
      'birthdate',
      'plateNumber',
      'deliveryDate',
      'deliveryState',
      'saleDate',
      'saleState',
      'origin',
    ];

    const customersData: Prisma.CustomerCreateManyInput[] = [];

    for (const [index, row] of rows.entries()) {
      const name = row['name']?.toString().trim();
      const phone = row['phone']?.toString().trim();

      if (!name || !phone) {
        console.warn(`Fila ${index + 2} omitida: faltan campos requeridos`);
        continue;
      }

      const customer: any = {
        name,
        email: null,
        phone,
        stateId: defaultState.id,
        address: null,
        city: null,
        department: null,
        document: null,
        birthdate: null,
        plateNumber: null,
        deliveryDate: null,
        deliveryState: null,
        saleDate: null,
        saleState: 'NA',
        origin: 'CRM',
      };

      // Copiar dinámicamente las columnas que existan
      for (const key of validColumns) {
        if (['name', 'phone'].includes(key)) continue;
        const value = row[key];
        if (value !== undefined && value !== null && value !== '') {
          if (['birthdate', 'deliveryDate'].includes(key)) {
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) customer[key] = parsed;
          } else {
            customer[key] = value.toString().trim();
          }
        }
      }

      customersData.push(customer);
    }

    if (!customersData.length) {
      throw new BadRequestException(
        'No se encontraron filas válidas para importar',
      );
    }

    const result = await this.prisma.customer.createMany({
      data: customersData,
      skipDuplicates: true,
    });

    return {
      success: true,
      message: `Importación completada: ${result.count} clientes creados (duplicados ignorados)`,
      count: result.count,
    };
  }

  async approveCustomer(id: number, dto: ApproveCustomerDto, user: any) {
    if (!hasRole(user.role, [Role.SUPER_ADMIN, Role.ADMIN, Role.COORDINADOR]))
      throw new ForbiddenException('No tienes permisos para aprobar');

    return await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id } });
      if (!customer) throw new NotFoundException('Cliente no encontrado');

      let generatedOrderNumber = customer.orderNumber;

      // GENERAR número solo si pasa a APROBADO y no tiene uno
      if (dto.saleState === 'APROBADO' && !customer.orderNumber) {
        const last = await tx.customer.findFirst({
          where: { orderNumber: { not: null } },
          orderBy: { orderNumber: 'desc' },
          select: { orderNumber: true },
        });

        if (!last || !last.orderNumber) {
          generatedOrderNumber = 'MRS0001';
        } else {
          const num = parseInt(last.orderNumber.replace('MRS', '')) + 1;
          generatedOrderNumber = `MRS${num.toString().padStart(4, '0')}`;
        }
      }

      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          saleState:
            dto.saleState === 'APROBADO' ? 'APROBADO' : customer.saleState,
          orderNumber: generatedOrderNumber,
          distributor: dto.distributor,
          approvalDate: dto.saleState === 'APROBADO' ? new Date() : null,
        },
      });

      // BORRAR Y RECREAR REGISTROS RELACIONADOS
      await tx.customerHolder.deleteMany({ where: { customerId: id } });
      await tx.customerPayment.deleteMany({ where: { customerId: id } });
      await tx.customerReceipt.deleteMany({ where: { customerId: id } });
      await tx.customerPurchase.deleteMany({ where: { customerId: id } });

      await tx.customerPurchase.create({
        data: { ...dto.purchase, customerId: id },
      });

      for (const h of dto.holders ?? []) {
        await tx.customerHolder.create({
          data: { ...h, customerId: id },
        });
      }

      for (const p of dto.payments ?? []) {
        await tx.customerPayment.create({
          data: { ...p, customerId: id },
        });
      }

      for (const r of dto.receipts ?? []) {
        await tx.customerReceipt.create({
          data: { ...r, customerId: id },
        });
      }

      return updatedCustomer;
    });
  }

  // Obtener todos los clientes aprobados
  async getApprovedCustomers(user: any) {
    if (
      !hasRole(user.role, [
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.AUXILIAR,
        Role.COORDINADOR,
        Role.ASESOR,
      ])
    ) {
      throw new ForbiddenException('No tienes permisos para ver aprobados');
    }

    const whereFilter: any = {
      saleState: 'APROBADO',
      NOT: {
        deliveryState: 'ENTREGADO',
      },
    };

    if (user.role === Role.ASESOR) {
      whereFilter.advisorId = user.userId;
    }

    const customers = await this.prisma.customer.findMany({
      where: whereFilter,
      include: {
        advisor: true,
        state: true,
        comments: {
          include: { createdBy: true },
          orderBy: { createdAt: 'desc' },
        },
        holders: true,
        purchase: true,
        payments: true,
        receipts: true,
        invoices: true,
        registration: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const customersWithBalance = customers.map((c) => {
      const paymentsWithNet = c.payments.map((p) => ({
        ...p,
        netForPurchase: (p.totalPayment ?? 0) - (p.aval ?? 0),
      }));

      const { outstandingBalance, creditBalance } =
        this.calculateOutstandingBalance(c);

      return {
        ...c,
        payments: paymentsWithNet,
        outstandingBalance,
        creditBalance,
      };
    });

    return {
      success: true,
      message: 'Clientes aprobados obtenidos correctamente',
      data: customersWithBalance,
    };
  }

  // Obtener cliente por orderNumber con outstandingBalance
  async getCustomerByOrderNumber(orderNumber: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { orderNumber },
      include: { purchase: true, payments: true, receipts: true },
    });

    if (!customer) {
      throw new NotFoundException(
        `No se encontró un cliente con el número de orden ${orderNumber}`,
      );
    }

    const { outstandingBalance, creditBalance } =
      this.calculateOutstandingBalance(customer);

    return {
      success: true,
      message: 'Cliente obtenido correctamente',
      data: {
        id: customer.id,
        orderNumber: customer.orderNumber,
        name: customer.name,
        outstandingBalance,
        creditBalance,
      },
    };
  }

  // Registrar pago en CustomerReceipt
  async registerPayment(
    customerId: number,
    dto: RegisterPaymentDto,
    user: any,
  ) {
    if (!hasRole(user.role, [Role.SUPER_ADMIN, Role.AUXILIAR])) {
      throw new ForbiddenException('No tienes permisos para registrar pagos');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const payment = await this.prisma.customerReceipt.create({
      data: {
        customerId,
        receiptNumber: dto.receiptNumber,
        date: new Date(dto.date),
        amount: dto.amount,
      },
    });

    return {
      success: true,
      message: 'Pago registrado correctamente',
      data: payment,
    };
  }

  // Consultar factura por orderNumber
  async findInvoiceByOrderNumber(orderNumber: string, user: any) {
    if (!hasRole(user.role, [Role.SUPER_ADMIN, Role.AUXILIAR])) {
      throw new ForbiddenException(
        'No tienes permisos para consultar facturas',
      );
    }

    if (!orderNumber || orderNumber.trim() === '') {
      throw new BadRequestException(
        'Debes proporcionar un número de orden válido',
      );
    }

    const customer = await this.prisma.customer.findUnique({
      where: { orderNumber },
      include: {
        invoices: {
          take: 1,
          orderBy: { id: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(
        `No se encontró un cliente con el número de orden ${orderNumber}`,
      );
    }

    const invoice = customer.invoices[0] || null;

    if (!invoice) {
      return {
        success: true,
        message: 'El cliente no tiene factura registrada',
        data: {
          invoice: null,
          customerName: customer.name,
        },
      };
    }

    return {
      success: true,
      message: 'Factura encontrada correctamente',
      data: {
        ...invoice,
        customerName: customer.name,
      },
    };
  }

  // Crear factura o actualizar si ya existe
  async createOrUpdateInvoiceByOrderNumber(
    orderNumber: string,
    dto: CreateCustomerInvoiceDto,
    user: any,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { orderNumber },
    });

    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const existingInvoice = await this.prisma.customerInvoice.findFirst({
      where: { customerId: customer.id },
    });

    if (existingInvoice) {
      if (user.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Solo el SUPER_ADMIN puede actualizar facturas',
        );
      }

      const updated = await this.prisma.customerInvoice.update({
        where: { id: existingInvoice.id },
        data: {
          ...dto,
          date: new Date(dto.date),
        },
      });

      return {
        success: true,
        message: 'Factura actualizada correctamente.',
        data: updated,
      };
    }

    if (!hasRole(user.role, [Role.SUPER_ADMIN, Role.AUXILIAR])) {
      throw new ForbiddenException('No tienes permisos para crear facturas');
    }

    const created = await this.prisma.customerInvoice.create({
      data: {
        ...dto,
        date: new Date(dto.date),
        customerId: customer.id,
      },
    });

    return {
      success: true,
      message: 'Factura creada correctamente.',
      data: created,
    };
  }

  // Consultar matrícula por orderNumber
  async findRegistrationByOrderNumber(orderNumber: string, user: any) {
    if (!hasRole(user.role, [Role.SUPER_ADMIN, Role.AUXILIAR])) {
      throw new ForbiddenException(
        'No tienes permisos para consultar matrículas',
      );
    }

    if (!orderNumber || orderNumber.trim() === '') {
      throw new BadRequestException(
        'Debes proporcionar un número de orden válido',
      );
    }

    const customer = await this.prisma.customer.findUnique({
      where: { orderNumber },
      include: {
        registration: {
          take: 1,
          orderBy: { id: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(
        `No se encontró un cliente con el número de orden ${orderNumber}`,
      );
    }

    const registration = customer.registration[0] || null;

    if (!registration) {
      return {
        success: true,
        message: 'El cliente no tiene matrícula registrada',
        data: {
          registration: null,
          customerName: customer.name,
        },
      };
    }
    return {
      success: true,
      message: 'Matrícula encontrada correctamente',
      data: {
        ...registration,
        customerName: customer.name,
      },
    };
  }

  // Crear matrícula o actualizar si ya existe
  async createOrUpdateRegistrationByOrderNumber(
    orderNumber: string,
    dto: CreateCustomerRegistrationDto,
    user: any,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { orderNumber },
    });

    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const existingRegistration =
      await this.prisma.customerRegistration.findFirst({
        where: { customerId: customer.id },
      });

    if (existingRegistration) {
      if (user.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Solo el SUPER_ADMIN puede actualizar matrículas',
        );
      }

      const registration = await this.prisma.customerRegistration.update({
        where: { id: existingRegistration.id },
        data: {
          ...dto,
          date: new Date(dto.date),
        },
      });

      return {
        success: true,
        message: 'Matrícula actualizada correctamente.',
        data: {
          ...registration,
          customerName: customer.name,
        },
      };
    }

    if (!hasRole(user.role, [Role.SUPER_ADMIN, Role.AUXILIAR])) {
      throw new ForbiddenException('No tienes permisos para crear matrículas');
    }

    const registration = await this.prisma.customerRegistration.create({
      data: {
        ...dto,
        date: new Date(dto.date),
        customerId: customer.id,
      },
    });

    return {
      success: true,
      message: 'Matrícula creada correctamente.',
      data: {
        ...registration,
        customerName: customer.name,
      },
    };
  }

  // Exportar clientes aprobados a Excel (con toda la info)
  // SOLO SUPER_ADMIN
  async exportCustomersFullExcel(
    user: any,
    where: Prisma.CustomerWhereInput,
  ): Promise<ArrayBuffer> {
    if (!hasRole(user.role, [Role.SUPER_ADMIN])) {
      throw new ForbiddenException('No tienes permisos para exportar clientes');
    }

    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { id: 'asc' },
      include: {
        advisor: true,
        state: true,
        holders: true,
        purchase: true,
        payments: true,
        receipts: true,
        invoices: true,
        registration: true,
      },
    });

    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Clientes');

    // ENCABEZADOS EN ESPAÑOL
    sheet.columns = [
      { header: 'Nombre', key: 'name', width: 25 },
      { header: 'Documento', key: 'document', width: 20 },
      { header: 'Correo', key: 'email', width: 25 },
      { header: 'Teléfono', key: 'phone', width: 15 },
      { header: 'Nacimiento', key: 'birthdate', width: 20 },
      { header: 'Dirección', key: 'address', width: 30 },
      { header: 'Ciudad', key: 'city', width: 20 },
      { header: 'Departamento', key: 'department', width: 20 },
      { header: 'Estado', key: 'state', width: 20 },
      { header: 'Estado de Entrega', key: 'deliveryState', width: 20 },
      { header: 'Fecha Creación', key: 'createdAt', width: 20 },
      { header: 'Fecha Asignación', key: 'assignedAt', width: 20 },
      { header: 'Asesor', key: 'advisor', width: 20 },
      { header: 'Fecha Venta', key: 'saleDate', width: 20 },
      {
        header: 'Mes Aprobación Venta',
        key: 'customerApprovalMonth',
        width: 30,
      },
      { header: 'Numero de Orden', key: 'orderNumber', width: 20 },
      { header: 'Estado Venta', key: 'saleState', width: 20 },
      { header: 'Entrega', key: 'deliveryDate', width: 20 },
      { header: 'Placa', key: 'plateNumber', width: 20 },
      { header: 'Origen', key: 'origin', width: 20 },
      { header: 'Distribuidor', key: 'distributor', width: 30 },

      // HOLDER PRINCIPAL (si hay)
      { header: 'Titular', key: 'holderName', width: 25 },
      { header: 'Doc Titular', key: 'holderDocument', width: 20 },
      { header: 'Correo Titular', key: 'holderEmail', width: 25 },
      { header: 'Teléfono Titular', key: 'holderPhone', width: 20 },
      { header: 'Dirección Titular', key: 'holderAddress', width: 30 },
      { header: 'Ciudad Titular', key: 'holderCity', width: 20 },
      { header: 'Entidad Titular', key: 'holderFinancialEntity', width: 25 },

      // PURCHASE
      { header: 'Marca', key: 'brand', width: 20 },
      { header: 'Referencia', key: 'reference', width: 20 },
      { header: 'Color Principal', key: 'mainColor', width: 20 },
      { header: 'Color Opcional', key: 'optionalColor', width: 20 },
      { header: 'Valor Comercial', key: 'commercialValue', width: 20 },
      { header: 'Valor Trámite', key: 'processValue', width: 20 },
      { header: 'Valor Total', key: 'totalValue', width: 20 },

      // PAYMENT (primer pago)
      { header: 'Entidad Financiera', key: 'paymentEntity', width: 20 },
      { header: 'Pago Total', key: 'paymentTotal', width: 15 },
      { header: 'Aval', key: 'aval', width: 15 },
      {
        header: 'Fecha Aprobación Crédito',
        key: 'paymentApprovalDate',
        width: 25,
      },

      // RECEIPT (primer recibo)
      { header: 'N° Recibo', key: 'receiptNumber', width: 20 },
      { header: 'Fecha Recibo', key: 'receiptDate', width: 20 },
      { header: 'Monto', key: 'receiptAmount', width: 15 },

      // INVOICE
      { header: 'Creación Factura', key: 'invoiceCreatedAt', width: 20 },
      { header: 'N° Factura', key: 'invoiceNumber', width: 20 },
      { header: 'Fecha Factura', key: 'invoiceDate', width: 20 },
      { header: 'Valor Factura', key: 'invoiceValue', width: 20 },
      { header: 'Chasis', key: 'chassisNumber', width: 25 },
      { header: 'Motor', key: 'engineNumber', width: 25 },

      // REGISTRATION
      { header: 'Registro Matrícula', key: 'registerCreatedAt', width: 20 },
      { header: 'Placa', key: 'plate', width: 15 },
      { header: 'SOAT', key: 'soatValue', width: 15 },
      { header: 'Matricula', key: 'registerValue', width: 15 },
      { header: 'Fecha Matricula', key: 'registerDate', width: 20 },
    ];

    customers.forEach((c) => {
      const holders = c.holders || [];
      const payments = c.payments || [];
      const receipts = c.receipts || [];
      const invoices = c.invoices || [];
      const registrations = Array.isArray(c.registration)
        ? c.registration
        : c.registration
          ? [c.registration]
          : [];

      // Obtener el máximo número de filas que debe generar este cliente
      const maxRows = Math.max(
        holders.length,
        payments.length,
        receipts.length,
        invoices.length,
        registrations.length,
        1,
      );

      for (let i = 0; i < maxRows; i++) {
        const holder = holders[i] || {};
        const payment = payments[i] || {};
        const receipt = receipts[i] || {};
        const invoice = invoices[i] || {};
        const reg = registrations[i] || {};

        sheet.addRow({
          // ================= CUSTOMER =================
          name: i === 0 ? c.name : '',
          document: i === 0 ? c.document : '',
          email: i === 0 ? c.email : '',
          phone: i === 0 ? c.phone : '',
          birthdate:
            i === 0 && c.birthdate
              ? new Date(c.birthdate).toLocaleDateString('es-CO', {
                  timeZone: 'UTC',
                })
              : '',
          address: i === 0 ? c.address : '',
          city: i === 0 ? c.city : '',
          department: i === 0 ? c.department : '',
          state: i === 0 ? c.state?.name : '',
          deliveryState: i === 0 ? c.deliveryState : '',
          assignedAt:
            i === 0 && c.assignedAt
              ? new Date(c.assignedAt).toLocaleDateString('es-CO', {
                  timeZone: 'UTC',
                })
              : '',
          createdAt:
            i === 0 && c.createdAt
              ? new Date(c.createdAt).toLocaleDateString('es-CO', {
                  timeZone: 'UTC',
                })
              : '',
          advisor: i === 0 ? c.advisor?.name : '',
          saleDate:
            i === 0 && c.saleDate
              ? new Date(c.saleDate).toLocaleDateString('es-CO', {
                  timeZone: 'UTC',
                })
              : '',
          customerApprovalMonth:
            i === 0 && c.approvalDate
              ? new Date(c.approvalDate).toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  timeZone: 'UTC',
                })
              : '',

          saleState: i === 0 ? c.saleState : '',
          orderNumber: i === 0 ? c.orderNumber : '',
          deliveryDate:
            i === 0 && c.deliveryDate
              ? new Date(c.deliveryDate).toLocaleDateString('es-CO', {
                  timeZone: 'UTC',
                })
              : '',
          plateNumber: i === 0 ? c.plateNumber : '',
          origin: i === 0 ? c.origin : '',
          distributor: i === 0 ? c.distributor : '',

          // ================= HOLDERS =================
          holderName: holder.fullName || '',
          holderDocument: holder.document || '',
          holderEmail: holder.email || '',
          holderPhone: holder.phone || '',
          holderAddress: holder.address || '',
          holderCity: holder.city || '',
          holderFinancialEntity: holder.financialEntity || '',

          // ================= PURCHASE =================
          brand: i === 0 ? c.purchase?.brand : '',
          reference: i === 0 ? c.purchase?.reference : '',
          mainColor: i === 0 ? c.purchase?.mainColor : '',
          optionalColor: i === 0 ? c.purchase?.optionalColor : '',
          commercialValue: i === 0 ? c.purchase?.commercialValue : '',
          processValue: i === 0 ? c.purchase?.processValue : '',
          totalValue: i === 0 ? c.purchase?.totalValue : '',

          // ================= PAYMENTS =================
          paymentEntity: payment.financialEntity || '',
          paymentTotal: payment.totalPayment || '',
          aval: payment.aval || '',
          paymentApprovalDate: payment.approvalDate
            ? new Date(payment.approvalDate).toLocaleDateString('es-CO', {
                timeZone: 'UTC',
              })
            : '',

          // ================= RECEIPTS =================
          receiptNumber: receipt.receiptNumber || '',
          receiptDate: receipt.date
            ? new Date(receipt.date).toLocaleDateString('es-CO', {
                timeZone: 'UTC',
              })
            : '',
          receiptAmount: receipt.amount || '',

          // ================= INVOICES =================
          invoiceCreatedAt: invoice.createdAt
            ? new Date(invoice.createdAt).toLocaleDateString('es-CO', {
                timeZone: 'UTC',
              })
            : '',
          invoiceNumber: invoice.invoiceNumber || '',
          invoiceDate: invoice.date
            ? new Date(invoice.date).toLocaleDateString('es-CO', {
                timeZone: 'UTC',
              })
            : '',
          invoiceValue: invoice.value || '',
          chassisNumber: invoice.chassisNumber || '',
          engineNumber: invoice.engineNumber || '',

          // ================= REGISTRATION =================
          registerCreatedAt: reg.createdAt
            ? new Date(reg.createdAt).toLocaleDateString('es-CO', {
                timeZone: 'UTC',
              })
            : '',
          plate: reg.plate || '',
          soatValue: reg.soatValue || '',
          registerValue: reg.registerValue || '',
          registerDate: reg.date
            ? new Date(reg.date).toLocaleDateString('es-CO', {
                timeZone: 'UTC',
              })
            : '',
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  // APROBADOS (FULL)
  // Exportar todos los clientes aprobados a Excel
  exportApprovedCustomersExcel(user: any) {
    return this.exportCustomersFullExcel(user, {
      saleState: 'APROBADO',
      NOT: {
        deliveryState: 'ENTREGADO',
      },
    });
  }

  // ENTREGADOS (FULL)
  // Exportar todos los clientes entregados a Excel
  exportDeliveredCustomersExcel(user: any) {
    return this.exportCustomersFullExcel(user, {
      deliveryState: 'ENTREGADO',
    });
  }

  // Calcular saldo pendiente CUSTOMER
  private calculateOutstandingBalance(customer: any): {
    outstandingBalance: number; // Saldo por pagar
    creditBalance: number; // Saldo a favor
  } {
    const payments = Array.isArray(customer.payments) ? customer.payments : [];
    const receipts = Array.isArray(customer.receipts) ? customer.receipts : [];
    const totalPurchase = customer.purchase?.totalValue ?? 0;

    const totalPayments = payments.reduce((sum, p) => {
      const totalPayment = p.totalPayment ?? 0;
      const aval = p.aval ?? 0;
      return sum + (totalPayment - aval);
    }, 0);

    const totalReceipts = receipts.reduce((sum, r) => sum + (r.amount ?? 0), 0);

    const netBalance = totalPurchase - (totalPayments + totalReceipts);

    return {
      outstandingBalance: Math.max(netBalance, 0),
      creditBalance: Math.max(-netBalance, 0),
    };
  }

  // Exportar orden de entrega en PDF para cliente aprobado
  async exportApprovedOrderPdf(customerId: number, user: any): Promise<Buffer> {
    if (!hasRole(user.role, [Role.SUPER_ADMIN, Role.COORDINADOR, Role.ADMIN])) {
      throw new ForbiddenException('No tienes permisos para exportar clientes');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        holders: true,
        purchase: true,
        invoices: true,
        registration: true,
        payments: true,
        receipts: true,
      },
    });

    if (!customer) throw new Error('Cliente no encontrado');

    const invoice = customer.invoices?.[0] ?? null;
    const registration = customer.registration?.[0] ?? null;

    const hasInvoice = !!invoice?.chassisNumber && !!invoice?.engineNumber;

    const hasRegistration = !!registration?.plate;

    if (!hasInvoice || !hasRegistration) {
      throw new BadRequestException(
        'No se puede generar la orden de entrega. ' +
          'Aún faltan datos obligatorios por registrar en facturación y/o matrícula.',
      );
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const result = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    const safe = (v: any): string => {
      if (!v) return '';
      if (v instanceof Date) return v.toLocaleDateString('es-CO');
      return String(v);
    };

    const TITLE_FONT = 12;
    const TABLE_FONT = 9;

    const marginLeft = 40;
    const pageWidth = doc.page.width - 80;

    const checkPage = (y: number): number => {
      if (y > 760) {
        doc.addPage();
        return 40;
      }
      return y;
    };

    const drawColumnTable = (
      title: string,
      columns: string[],
      values: any[],
      y: number,
    ) => {
      y = checkPage(y);

      doc
        .font('Helvetica-Bold')
        .fontSize(TITLE_FONT)
        .text(title, marginLeft, y);
      y += 18;

      const colCount = columns.length;
      const colWidth = pageWidth / colCount;
      const rowHeight = 26;

      // Encabezado
      doc.rect(marginLeft, y, pageWidth, rowHeight).stroke();

      columns.forEach((col, i) => {
        const colX = marginLeft + colWidth * i;

        if (i > 0) {
          doc
            .moveTo(colX, y)
            .lineTo(colX, y + rowHeight)
            .stroke();
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(TABLE_FONT)
          .text(col, colX + 5, y + 8, {
            width: colWidth - 10,
            align: 'center',
          });
      });

      y += rowHeight;

      // Fila de datos
      doc.rect(marginLeft, y, pageWidth, rowHeight).stroke();

      values.forEach((val, i) => {
        const colX = marginLeft + colWidth * i;

        if (i > 0) {
          doc
            .moveTo(colX, y)
            .lineTo(colX, y + rowHeight)
            .stroke();
        }

        doc
          .font('Helvetica')
          .fontSize(TABLE_FONT)
          .text(safe(val), colX + 5, y + 8, {
            width: colWidth - 10,
            align: 'center',
          });
      });

      y += rowHeight + 20;

      return y;
    };

    const drawHoldersTable = (title: string, holders: any[], y: number) => {
      y = checkPage(y);

      doc
        .font('Helvetica-Bold')
        .fontSize(TITLE_FONT)
        .text(title, marginLeft, y);
      y += 18;

      const columns = [
        'Nombre',
        'Documento',
        'Teléfono',
        'Correo',
        'Dirección',
      ];
      const colCount = columns.length;
      const colWidth = pageWidth / colCount;
      const rowHeight = 26;

      // Header
      doc.rect(marginLeft, y, pageWidth, rowHeight).stroke();

      columns.forEach((col, i) => {
        const colX = marginLeft + colWidth * i;
        if (i > 0)
          doc
            .moveTo(colX, y)
            .lineTo(colX, y + rowHeight)
            .stroke();

        doc
          .font('Helvetica-Bold')
          .fontSize(TABLE_FONT)
          .text(col, colX + 5, y + 8, {
            width: colWidth - 10,
            align: 'center',
          });
      });

      y += rowHeight;

      // Filas de titulares
      for (const h of holders) {
        y = checkPage(y);

        const vals = [
          h.fullName || '',
          h.document || '',
          h.phone || '',
          h.email || '',
          h.address || '',
        ];

        doc.rect(marginLeft, y, pageWidth, rowHeight).stroke();

        vals.forEach((val, i) => {
          const colX = marginLeft + colWidth * i;
          if (i > 0)
            doc
              .moveTo(colX, y)
              .lineTo(colX, y + rowHeight)
              .stroke();

          doc
            .font('Helvetica')
            .fontSize(TABLE_FONT)
            .text(safe(val), colX + 5, y + 8, {
              width: colWidth - 10,
              align: 'center',
            });
        });

        y += rowHeight;
      }

      return y + 20;
    };

    const logoPath = path.join(process.cwd(), 'public', 'logoMotoRenting.png');

    doc.rect(40, 40, 510, 90).stroke();

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 55, { width: 90 });
    }

    doc.font('Helvetica-Bold').fontSize(12).text('MOTORENTING SAS', 170, 55);
    doc.fontSize(11).text('NIT: 901746795-7', 170, 75);
    doc.text('Dirección: AV BOYACÁ # 8B 21 / # 8B 67, Bogotá', 170, 90);
    doc.text('Teléfono: 3202392963', 170, 105);

    let y = 150;

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('ORDEN DE ENTREGA', 0, y, { align: 'center' });

    y += 20;

    // INFORMACIÓN CLIENTE
    y = drawColumnTable(
      'INFORMACIÓN DEL CLIENTE',
      [
        'Nombre',
        'Documento',
        'Teléfono',
        'Correo',
        'Ciudad',
        'Depto',
        'Dirección',
      ],
      [
        customer.name,
        customer.document,
        customer.phone,
        customer.email,
        customer.city,
        customer.department,
        customer.address,
      ],
      y,
    );

    // DATOS ADICIONALES
    y = drawColumnTable(
      'DATOS ADICIONALES',
      ['Nacimiento', 'Registro', 'Venta'],
      [customer.birthdate, customer.createdAt, customer.saleDate],
      y,
    );

    // TITULARES
    if (customer.holders.length > 0) {
      y = drawHoldersTable('TITULARES', customer.holders, y);
    }

    // DATOS DE LA COMPRA
    y = drawColumnTable(
      'DATOS DE LA COMPRA',
      ['Marca', 'Referencia', 'Color'],
      [
        customer.purchase?.brand,
        customer.purchase?.reference,
        customer.purchase?.mainColor,
      ],
      y,
    );

    // INFORMACIÓN VEHÍCULO
    y = drawColumnTable(
      'INFORMACIÓN VEHÍCULO',
      ['Chasis', 'Motor', 'Placa'],
      [invoice.chassisNumber, invoice.engineNumber, registration?.plate],
      y,
    );

    // SALDO PENDIENTE
    const { outstandingBalance, creditBalance } =
      this.calculateOutstandingBalance(customer);

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(
        `SALDO PENDIENTE: $ ${outstandingBalance.toLocaleString('es-CO')}`,
        marginLeft,
        y,
      );

    y += 20;

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(
        `SALDO A FAVOR: $ ${creditBalance.toLocaleString('es-CO')}`,
        marginLeft,
        y,
      );

    y += 40;

    // FIRMA CLIENTE
    doc.font('Helvetica').fontSize(10).text('Firma del cliente:', 40, y);
    y += 20;
    doc
      .moveTo(40, y + 30)
      .lineTo(300, y + 30)
      .stroke();

    y += 50;

    const acceptanceText =
      'Declaro que he recibido el vehículo en perfecto estado de funcionamiento, ' +
      'junto con todos los documentos, accesorios y elementos entregados. ' +
      'Manifiesto que la información suministrada es correcta y acepto los términos ' +
      'y condiciones del contrato firmado con MOTORENTING SAS.';

    doc.font('Helvetica').fontSize(8).text(acceptanceText, 40, y);

    doc.end();
    return result;
  }
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().split('T')[0]; // yyyy-mm-dd
}
