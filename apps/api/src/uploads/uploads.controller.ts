import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageService } from '../storage/storage.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storageService: StorageService) {}

  @Get('*path')
  async serveFile(@Param('path') filePath: string[], @Res() res: Response) {
    const relativePath = filePath.join('/');
    const fullPath = path.join(
      this.storageService.getLocalStoragePath(),
      relativePath,
    );

    try {
      await fs.access(fullPath);
      return res.sendFile(path.resolve(fullPath));
    } catch {
      throw new NotFoundException('File not found');
    }
  }
}
