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
import { ReplyFeedbackDto } from './dto/reply-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.create(req.user.id, dto);
  }

  @Post('public')
  createPublic(@Body() dto: CreateFeedbackDto) {
    return this.feedbackService.createPublic(dto);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  unreadCount(@Req() req: { user: { id: string } }) {
    return this.feedbackService.countUnreadRepliesForUser(req.user.id);
  }

  @Post('mark-read')
  @UseGuards(JwtAuthGuard)
  markRead(@Req() req: { user: { id: string } }) {
    return this.feedbackService.markRepliesReadForUser(req.user.id);
  }

  @Get('admin/unread-count')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminUnreadCount() {
    return this.feedbackService.countNewForAdmin();
  }

  @Post('admin/mark-read')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminMarkRead() {
    return this.feedbackService.markAllReadForAdmin();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard, AdminGuard)
  listAdmin(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.feedbackService.listAdmin({
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
    });
  }

  @Get('admin/:id/messages')
  @UseGuards(JwtAuthGuard, AdminGuard)
  listMessages(@Param('id', ParseUUIDPipe) id: string) {
    return this.feedbackService.listMessages(id);
  }

  @Post('admin/:id/reply')
  @UseGuards(JwtAuthGuard, AdminGuard)
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyFeedbackDto,
  ) {
    return this.feedbackService.replyAdmin(id, dto.message);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updateAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.feedbackService.updateAdmin(id, dto);
  }
}
