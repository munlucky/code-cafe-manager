import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { Order, Barista, Receipt } from './types.js';

/**
 * JSON 기반 데이터 저장소
 */
export class Storage {
  private dataDir: string;
  private ordersFile: string;
  private baristasFile: string;
  private receiptsFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.ordersFile = join(dataDir, 'orders.json');
    this.baristasFile = join(dataDir, 'baristas.json');
    this.receiptsFile = join(dataDir, 'receipts.json');
  }

  /**
   * 스토리지 초기화
   */
  async init(): Promise<void> {
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }

    // 파일이 없으면 빈 배열로 초기화
    if (!existsSync(this.ordersFile)) {
      await this.saveOrders([]);
    }
    if (!existsSync(this.baristasFile)) {
      await this.saveBaristas([]);
    }
    if (!existsSync(this.receiptsFile)) {
      await this.saveReceipts([]);
    }
  }

  /**
   * Orders 저장/로드
   */
  async saveOrders(orders: Order[]): Promise<void> {
    await writeFile(this.ordersFile, JSON.stringify(orders, null, 2), 'utf-8');
  }

  async loadOrders(): Promise<Order[]> {
    if (!existsSync(this.ordersFile)) {
      return [];
    }
    const content = await readFile(this.ordersFile, 'utf-8');
    const orders = JSON.parse(content);
    // Date 복원
    return orders.map((order: any) => ({
      ...order,
      createdAt: new Date(order.createdAt),
      startedAt: order.startedAt ? new Date(order.startedAt) : null,
      endedAt: order.endedAt ? new Date(order.endedAt) : null,
    }));
  }

  /**
   * Baristas 저장/로드
   */
  async saveBaristas(baristas: Barista[]): Promise<void> {
    await writeFile(this.baristasFile, JSON.stringify(baristas, null, 2), 'utf-8');
  }

  async loadBaristas(): Promise<Barista[]> {
    if (!existsSync(this.baristasFile)) {
      return [];
    }
    const content = await readFile(this.baristasFile, 'utf-8');
    const baristas = JSON.parse(content);
    // Date 복원
    return baristas.map((barista: any) => ({
      ...barista,
      createdAt: new Date(barista.createdAt),
      lastActivityAt: new Date(barista.lastActivityAt),
    }));
  }

  /**
   * Receipts 저장/로드
   */
  async saveReceipts(receipts: Receipt[]): Promise<void> {
    await writeFile(this.receiptsFile, JSON.stringify(receipts, null, 2), 'utf-8');
  }

  async loadReceipts(): Promise<Receipt[]> {
    if (!existsSync(this.receiptsFile)) {
      return [];
    }
    const content = await readFile(this.receiptsFile, 'utf-8');
    const receipts = JSON.parse(content);
    // Date 복원
    return receipts.map((receipt: any) => ({
      ...receipt,
      startedAt: new Date(receipt.startedAt),
      endedAt: new Date(receipt.endedAt),
    }));
  }

  /**
   * Receipt 추가
   */
  async addReceipt(receipt: Receipt): Promise<void> {
    const receipts = await this.loadReceipts();
    receipts.push(receipt);
    await this.saveReceipts(receipts);
  }
}
