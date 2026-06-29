import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { getBillingConfig } from '../config/billing';
import { BillingService } from './billing.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { CreatePackageDto, UpdatePackageDto } from './dto/package.dto';
import { OrderStatus } from './order.entity';

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('packages')
  listPackages() {
    return this.billingService.listActivePackages();
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  createOrder(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateOrderDto,
  ) {
    return this.billingService.createOrder(req.user.id, dto.packageId, dto.note);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  listMyOrders(@Req() req: { user: { id: string } }) {
    return this.billingService.listMyOrders(req.user.id);
  }

  @Post('orders/:id/pay')
  @UseGuards(JwtAuthGuard)
  payOrder(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayOrderDto,
  ) {
    return this.billingService.payOrder(
      req.user.id,
      id,
      dto.singleUseToken,
      dto.saveCard ?? false,
    );
  }

  @Post('orders/:id/pay-saved')
  @UseGuards(JwtAuthGuard)
  payOrderWithSavedCard(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingService.payOrderWithSavedCard(req.user.id, id);
  }

  @Get('payment-method')
  @UseGuards(JwtAuthGuard)
  getSavedCard(@Req() req: { user: { id: string } }) {
    return this.billingService.getSavedCard(req.user.id);
  }

  @Delete('payment-method')
  @UseGuards(JwtAuthGuard)
  deleteSavedCard(@Req() req: { user: { id: string } }) {
    return this.billingService.deleteSavedCard(req.user.id);
  }
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminBillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('billing-config')
  getBillingConfig() {
    return getBillingConfig();
  }

  @Get('packages')
  listPackages() {
    return this.billingService.listAllPackages();
  }

  @Post('packages')
  createPackage(@Body() dto: CreatePackageDto) {
    return this.billingService.createPackage(dto);
  }

  @Patch('packages/:id')
  updatePackage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.billingService.updatePackage(id, dto);
  }

  @Get('orders')
  listOrders(@Query('status') status?: OrderStatus) {
    return this.billingService.listOrders(status || undefined);
  }

  @Get('orders/pending-count')
  pendingCount() {
    return this.billingService
      .countPendingOrders()
      .then((pending) => ({ pending }));
  }

  @Post('orders/:id/approve')
  approveOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.billingService.approveOrder(id, req.user.id);
  }

  @Post('orders/:id/reject')
  rejectOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.billingService.rejectOrder(id, req.user.id);
  }
}
