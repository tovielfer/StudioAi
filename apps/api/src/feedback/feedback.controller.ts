import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  create(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.create(req.user.id, dto);
  }

  @Get('unread-count')
  unreadCount(@Req() req: { user: { id: string } }) {
    return this.feedbackService.countUnreadRepliesForUser(req.user.id);
  }

  @Post('mark-read')
  markRead(@Req() req: { user: { id: string } }) {
    return this.feedbackService.markRepliesReadForUser(req.user.id);
  }

  @Get('admin/unread-count')
  @UseGuards(AdminGuard)
  adminUnreadCount() {
    return this.feedbackService.countNewForAdmin();
  }

  @Post('admin/mark-read')
  @UseGuards(AdminGuard)
  adminMarkRead() {
    return this.feedbackService.markAllReadForAdmin();
  }

  @Get()
  listMine(
    @Req() req: { user: { id: string } },
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.feedbackService.listByUser(req.user.id, {
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
    });
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  listAdmin(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.feedbackService.listAdmin({
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
    });
  }

  @Patch('admin/:id')
  @UseGuards(AdminGuard)
  updateAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.feedbackService.updateAdmin(id, dto);
  }
}
