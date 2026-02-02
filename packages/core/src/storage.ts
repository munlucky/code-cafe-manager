import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { Order, Barista, Receipt } from './types.js';

/**
 * Raw JSON types for type-safe parsing
 */
interface OrderJson {
  id: string;
  workflowId: string;
  workflowName: string;
  baristaId: string | null;
  status: string;
  counter: string;
  provider: string;
  vars: Record<string, string>;
  prompt?: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  error?: string;
  worktreeInfo?: {
    path: string;
    branch: string;
    baseBranch: string;
    repoPath?: string;
    removed?: boolean;
    merged?: boolean;
    mergedTo?: string;
    mergeCommit?: string;
  };
  cafeId?: string;
  recipeId?: string;
  recipeName?: string;
}

interface BaristaJson {
  id: string;
  status: string;
  currentOrderId: string | null;
  provider: string;
  role?: string;
  createdAt: string;
  lastActivityAt: string;
}

interface ReceiptJson {
  orderId: string;
  status: string;
  startedAt: string;
  endedAt: string;
  provider: string;
  counter: string;
  errorSummary?: string;
  changedFiles?: string[];
  logs?: string;
}

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
   * Generic JSON file loader with transformation
   */
  private async loadJsonFile<TRaw, TResult>(
    filepath: string,
    transformer: (data: TRaw) => TResult
  ): Promise<TResult[]> {
    if (!existsSync(filepath)) {
      return [];
    }
    const content = await readFile(filepath, 'utf-8');
    if (!content) {
      return [];
    }
    const rawData = JSON.parse(content) as TRaw[];
    return rawData.map(transformer);
  }

  /**
   * Orders 저장/로드
   */
  async saveOrders(orders: Order[]): Promise<void> {
    await writeFile(this.ordersFile, JSON.stringify(orders, null, 2), 'utf-8');
  }

  async loadOrders(): Promise<Order[]> {
    return this.loadJsonFile<OrderJson, Order>(
      this.ordersFile,
      (order) => ({
        ...order,
        createdAt: new Date(order.createdAt),
        startedAt: order.startedAt ? new Date(order.startedAt) : null,
        endedAt: order.endedAt ? new Date(order.endedAt) : null,
      }) as Order
    );
  }

  /**
   * Baristas 저장/로드
   */
  async saveBaristas(baristas: Barista[]): Promise<void> {
    await writeFile(this.baristasFile, JSON.stringify(baristas, null, 2), 'utf-8');
  }

  async loadBaristas(): Promise<Barista[]> {
    return this.loadJsonFile<BaristaJson, Barista>(
      this.baristasFile,
      (barista) => ({
        ...barista,
        createdAt: new Date(barista.createdAt),
        lastActivityAt: new Date(barista.lastActivityAt),
      }) as Barista
    );
  }

  /**
   * Receipts 저장/로드
   */
  async saveReceipts(receipts: Receipt[]): Promise<void> {
    await writeFile(this.receiptsFile, JSON.stringify(receipts, null, 2), 'utf-8');
  }

  async loadReceipts(): Promise<Receipt[]> {
    return this.loadJsonFile<ReceiptJson, Receipt>(
      this.receiptsFile,
      (receipt) => ({
        ...receipt,
        startedAt: new Date(receipt.startedAt),
        endedAt: new Date(receipt.endedAt),
      }) as Receipt
    );
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
