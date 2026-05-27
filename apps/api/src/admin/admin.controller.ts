import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerationStatus } from '../common/constants';
import { AdminService } from './admin.service';
import { AddUserCreditsDto } from './dto/add-user-credits.dto';

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
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listUsers({
      search: search?.trim() || undefined,
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
    });
  }

  @Get('generations')
  listGenerations(
    @Query('status') status?: GenerationStatus,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.adminService.listGenerations({
      status: status || undefined,
      userId: userId?.trim() || undefined,
      search: search?.trim() || undefined,
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
    });
  }

  @Post('users/:id/credits')
  addCredits(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddUserCreditsDto,
  ) {
    return this.adminService.addCredits(id, dto.amount, dto.reason);
  }
}
