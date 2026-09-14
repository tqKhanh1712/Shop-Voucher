import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ContentService } from './content.service';
import {
  ContentQueryDto,
  PublicContentQueryDto,
} from './dto/content-query.dto';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { Request } from 'express';

type AdminRequest = Request & { user: { userId: string } };

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  listPublic(@Query() query: PublicContentQueryDto) {
    return this.contentService.listPublic(query);
  }

  @Get('slug/:slug')
  getPublicBySlug(@Param('slug') slug: string) {
    return this.contentService.getPublicBySlug(slug);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listAdmin(@Query() query: ContentQueryDto) {
    return this.contentService.listAdmin(query);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Req() req: AdminRequest, @Body() dto: CreateContentDto) {
    return this.contentService.create(req.user.userId, dto, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  @Patch('admin/:contentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @Req() req: AdminRequest,
    @Param('contentId', new ParseUUIDPipe({ version: '4' })) contentId: string,
    @Body() dto: UpdateContentDto,
  ) {
    return this.contentService.update(req.user.userId, contentId, dto, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
}
