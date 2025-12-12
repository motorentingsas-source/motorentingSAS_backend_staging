import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssignMultipleDto } from './dto/assign-multiple.dto';
import type { Response } from 'express';
import { ApproveCustomerDto } from './dto/approve-customer.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { CreateCustomerInvoiceDto } from './dto/create-customer-invoice.dto';
import { CreateCustomerRegistrationDto } from './dto/create-customer-registration.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  // GET /customers
  // SUPER_ADMIN y ADMIN: obtiene todos los clientes con comentarios y asesor asignado
  // ASESOR: solo sus clientes
  @Get()
  getAllCustomers(@Req() req) {
    return this.customersService.getCustomers(req.user);
  }

  // GET /customers/delivered
  // SUPER_ADMIN y ADMIN: todos los entregados
  // ASESOR: solo sus entregados
  @Get('/delivered')
  getDeliveredCustomers(@Req() req) {
    return this.customersService.getDeliveredCustomers(req.user);
  }

  // GET /customers/delivered/export
  // Exporta los clientes entregados a Excel
  @Get('/delivered/export')
  async exportDeliveredCustomers(@Req() req, @Res() res: Response) {
    const buffer = await this.customersService.exportDeliveredCustomersExcel(
      req.user,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=clientes_entregados_${Date.now()}.xlsx`,
    );

    res.send(buffer);
  }

  // GET /customers/export-approved
  // Exporta todos los clientes APROBADOS en una sola hoja Excel
  @Get('/export-approved')
  async exportAllApprovedCustomers(@Req() req, @Res() res) {
    const buffer = await this.customersService.exportAllApprovedCustomers(
      req.user,
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=clientes_aprobados_${Date.now()}.xlsx`,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.send(Buffer.from(buffer));
  }

  // GET /customers/:id/order-delivery
  // Descargar orden de entrega en PDF para cliente aprobado
  @Get('/:id/order-delivery')
  async exportApprovedOrderPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res,
    @Req() req,
  ) {
    const buffer = await this.customersService.exportApprovedOrderPdf(
      id,
      req.user,
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=orden_entrega.pdf`,
    );
    res.setHeader('Content-Type', 'application/pdf');

    res.send(buffer);
  }

  // GET /customers/approved
  @Get('/approved')
  getApprovedCustomers(@Req() req) {
    return this.customersService.getApprovedCustomers(req.user);
  }

  // GET /customers/sale
  // SUPER_ADMIN, ADMIN, COORDINADOR: ven todos los clientes en venta
  @Get('/preApproved')
  getSaleCustomers(@Req() req) {
    return this.customersService.getSaleCustomers(req.user);
  }

  // GET /customers/:id
  // SUPER_ADMIN y ADMIN puede consultar cualquier cliente
  // ASESOR solo puede ver sus clientes
  @Get('/:id')
  getCustomerById(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.customersService.getCustomerById(id, req.user);
  }

  // GET /customers/order/:orderNumber
  @Get('/order/:orderNumber')
  getCustomerByOrderNumber(@Param('orderNumber') orderNumber: string) {
    return this.customersService.getCustomerByOrderNumber(orderNumber);
  }

  // POST /customers/:id/payments
  // Registrar un pago para un cliente
  @Post('/:id/payments')
  async registerPayment(
    @Param('id', ParseIntPipe) customerId: number,
    @Body() dto: RegisterPaymentDto,
    @Req() req,
  ) {
    return this.customersService.registerPayment(customerId, dto, req.user);
  }

  // GET /customers/:orderNumber
  // Obtener factura por número de orden
  @Get('/invoices/:orderNumber')
  async getByOrderNumber(@Param('orderNumber') orderNumber, @Req() req) {
    return await this.customersService.findInvoiceByOrderNumber(
      orderNumber,
      req.user,
    );
  }

  // POST /customers/:orderNumber/invoices
  // Crear o actualizar factura por número de orden
  @Post('/:orderNumber/invoices')
  async registerInvoice(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: CreateCustomerInvoiceDto,
    @Req() req,
  ) {
    return this.customersService.createOrUpdateInvoiceByOrderNumber(
      orderNumber,
      dto,
      req.user,
    );
  }

  // GET /customers/registration/:orderNumber
  // Obtener matriculas por número de orden
  @Get('/registrations/:orderNumber')
  async getRegistrationByOrderNumber(
    @Param('orderNumber') orderNumber,
    @Req() req,
  ) {
    return await this.customersService.findRegistrationByOrderNumber(
      orderNumber,
      req.user,
    );
  }

  // POST /customers/:orderNumber/registrations
  // Crear o actualizar matricula por número de orden
  @Post('/:orderNumber/registrations')
  async registerRegistration(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: CreateCustomerRegistrationDto,
    @Req() req,
  ) {
    return this.customersService.createOrUpdateRegistrationByOrderNumber(
      orderNumber,
      dto,
      req.user,
    );
  }

  // POST /customers
  // Crea un cliente
  // SUPER_ADMIN y ADMIN puede asignar cualquier asesor
  // ASESOR solo se asigna a sí mismo
  @Post()
  createCustomer(@Body() dto: CreateCustomerDto, @Req() req) {
    return this.customersService.createCustomer(dto, req.user);
  }

  // PUT /customers/:id
  // Actualiza un cliente existente
  // SUPER_ADMIN y ADMIN puede actualizar cualquiera
  // ASESOR solo sus clientes
  @Put('/:id')
  updateCustomer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
    @Req() req,
  ) {
    return this.customersService.updateCustomer(id, dto, req.user);
  }

  // DELETE /customers/:id
  // Solo SUPER_ADMIN y ADMIN puede eliminar clientes
  @Delete('/:id')
  deleteCustomer(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.customersService.deleteCustomer(id, req.user);
  }

  // POST /customers/:id/comments
  // Agrega un comentario al cliente
  // SUPER_ADMIN y ADMIN: cualquier cliente
  // ASESOR: solo sus clientes
  @Post('/:id/comments')
  addComment(
    @Param('id', ParseIntPipe) id: number,
    @Body('description') description: string,
    @Body('saleState') saleState: string,
    @Req() req,
  ) {
    return this.customersService.addComment(
      id,
      description,
      saleState,
      req.user,
    );
  }

  // POST /customers/:id/assign/:advisorId
  // Reasigna un cliente a otro asesor
  // Solo SUPER_ADMIN y ADMIN puede usar
  @Post('/:id/assign/:advisorId')
  assignAdvisor(
    @Param('id', ParseIntPipe) id: number,
    @Param('advisorId', ParseIntPipe) advisorId: number,
    @Req() req,
  ) {
    return this.customersService.assignAdvisor(id, advisorId, req.user);
  }

  // POST /customers/assign-multiple
  // Asigna múltiples clientes a un asesor
  // Solo SUPER_ADMIN y ADMIN puede usar
  @Post('/assign-multiple')
  assignMultipleCustomers(@Body() dto: AssignMultipleDto, @Req() req) {
    return this.customersService.assignMultipleCustomers(dto, req.user);
  }

  // POST /customers/import con form-data (campo: file)
  // Importar clientes desde Excel
  // Solo SUPER_ADMIN y ADMIN puede usar
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importCustomers(@UploadedFile() file: Express.Multer.File, @Req() req) {
    return this.customersService.importCustomers(file, req.user);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveCustomerDto,
    @Req() req,
  ) {
    return this.customersService.approveCustomer(Number(id), dto, req.user);
  }
}
