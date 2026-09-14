import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

function positiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Service quản lý kết nối cơ sở dữ liệu sử dụng Prisma Client và driver adapter cho PostgreSQL.
 * Được kế thừa từ PrismaClient để kế thừa các API truy vấn trực tiếp.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required.');
    }

    // Bước 1: Thiết lập pool kết nối và adapter của pg - yêu cầu bắt buộc của Prisma 7
    const pool = new pg.Pool({
      connectionString,
      max: positiveIntegerEnv('DB_POOL_MAX', 10),
      idleTimeoutMillis: positiveIntegerEnv('DB_POOL_IDLE_TIMEOUT_MS', 30_000),
      connectionTimeoutMillis: positiveIntegerEnv(
        'DB_POOL_CONNECTION_TIMEOUT_MS',
        10_000,
      ),
      keepAlive: true,
    });
    const adapter = new PrismaPg(pool);

    // Bước 2: Truyền adapter vào constructor của lớp cha PrismaClient
    super({ adapter });
    this.pool = pool;
  }

  /**
   * Thiết lập kết nối khi ứng dụng khởi chạy.
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Đóng kết nối khi ứng dụng dừng hoạt động.
   */
  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
