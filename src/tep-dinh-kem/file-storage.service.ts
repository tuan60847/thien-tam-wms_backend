import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { appConfig } from '../config/app.config.js';

// Files live under UPLOAD_DIR; the database stores only the relative path returned by
// `save`. Every path is generated here (never from client input) and re-checked to stay
// inside the root before it is read or removed.
@Injectable()
export class FileStorageService {
  private readonly root: string;

  constructor(@Inject(appConfig.KEY) config: ConfigType<typeof appConfig>) {
    this.root = resolve(config.uploadDir);
  }

  async save(
    folder: string,
    extension: string,
    content: Buffer,
  ): Promise<string> {
    const year = String(new Date().getUTCFullYear());
    const relative = `${folder}/${year}/${randomUUID()}${extension}`;
    const absolute = this.resolveInside(relative);
    await mkdir(dirname(absolute), { recursive: true });
    // `wx` never overwrites an existing file.
    await writeFile(absolute, content, { flag: 'wx' });
    return relative;
  }

  // Resolves to null when the file is missing on disk (the DB row outlived the file).
  async open(relative: string): Promise<ReadStream | null> {
    const absolute = this.resolveInside(relative);
    try {
      await stat(absolute);
    } catch {
      return null;
    }
    return createReadStream(absolute);
  }

  async remove(relative: string): Promise<void> {
    await rm(this.resolveInside(relative), { force: true });
  }

  private resolveInside(relative: string): string {
    const absolute = resolve(this.root, relative);
    if (!absolute.startsWith(this.root + sep)) {
      throw new Error('Path escapes the upload directory');
    }
    return absolute;
  }
}
