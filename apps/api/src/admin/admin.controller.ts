import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerationStatus } from '../common/constants';
import { AdminService } from './admin.service';
import { AddUserCreditsDto } from './dto/add-user-credits.dto';
import { HardDeleteGenerationsDto } from './dto/hard-delete-generations.dto';
import { SendUserEmailDto } from './dto/send-user-email.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  listUsers(
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    const allowedSorts = [
      'newest',
      'oldest',
      'generations',
      'credits',
      'email',
    ] as const;
    type SortOption = (typeof allowedSorts)[number];
    const sortOption = allowedSorts.includes(sort as SortOption)
      ? (sort as SortOption)
      : 'newest';

    return this.adminService.listUsers({
      search: search?.trim() || undefined,
      sort: sortOption,
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
    });
  }

  @Get('credit-transactions')
  listCreditTransactions(
    @Query('search') search?: string,
    @Query('userId') userId?: string,
    @Query('direction') direction?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listCreditTransactions({
      search: search?.trim() || undefined,
      userId: userId?.trim() || undefined,
      direction:
        direction === 'credit' || direction === 'debit'
          ? direction
          : undefined,
      from: from?.trim() || undefined,
      to: to?.trim() || undefined,
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
    });
  }

  @Get('generations')
  listGenerations(
    @Query('status') status?: GenerationStatus,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('provider') provider?: string,
    @Query('model') model?: string,
    @Query('quality') quality?: string,
    @Query('size') size?: string,
    @Query('resolution') resolution?: string,
    @Query('hasReference') hasReference?: string,
    @Query('onlyDeleted') onlyDeleted?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listGenerations({
      status: status || undefined,
      userId: userId?.trim() || undefined,
      search: search?.trim() || undefined,
      type: type?.trim() || undefined,
      provider: provider?.trim() || undefined,
      model: model?.trim() || undefined,
      quality: quality?.trim() || undefined,
      size: size?.trim() || undefined,
      resolution: resolution?.trim() || undefined,
      hasReference:
        hasReference === 'true'
          ? true
          : hasReference === 'false'
            ? false
            : undefined,
      onlyDeleted: onlyDeleted === 'true' ? true : undefined,
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
    });
  }

  @Post('generations/hard-delete')
  hardDeleteGenerations(@Body() dto: HardDeleteGenerationsDto) {
    return this.adminService.hardDeleteGenerations(dto.ids);
  }

  @Post('generations/:id/send-email')
  sendGenerationEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { email: string } },
  ) {
    return this.adminService.sendGenerationEmail(id, req.user.email);
  }

  @Post('generations/:id/cancel')
  cancelGeneration(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.cancelGeneration(id);
  }

  @Get('cost-stats')
  getCostStats() {
    return this.adminService.getCostStats();
  }

  @Get('pricing-rules')
  listPricingRules() {
    return this.adminService.listPricingRules();
  }

  @Patch('pricing-rules/:id')
  updatePricingRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePricingRuleDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.adminService.updatePricingRule(id, dto, req.user.id);
  }

  @Get('pricing-rules/:id/generations')
  listPricingRuleGenerations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listPricingRuleGenerations(
      id,
      Math.min(Math.max(limit, 1), 100),
      Math.max(offset, 0),
    );
  }

  @Get('pricing-rules/:id/audit-log')
  getPricingRuleAuditLog(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getPricingRuleAuditLog(id);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.adminService.updateUser(id, dto, req.user.id);
  }

  @Post('users/:id/credits')
  addCredits(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddUserCreditsDto,
  ) {
    return this.adminService.addCredits(id, dto.amount, dto.reason);
  }

  @Post('users/:id/send-email')
  sendUserEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendUserEmailDto,
  ) {
    return this.adminService.sendUserEmail(id, dto.subject, dto.message);
  }
}
