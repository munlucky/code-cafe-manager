/**
 * Barista Manager with Role Integration
 * Phase 2: Role-based Barista creation with backward compatibility
 */

import { EventEmitter } from 'events';
import { Barista, BaristaEvent, BaristaStatus, EventType, ProviderType } from '@codecafe/core';
import { RoleManager } from '../role/role-manager';
import { Role } from '../types';

/**
 * Enhanced Barista Manager with Role support
 */
export class BaristaManager extends EventEmitter {
  private baristas: Map<string, Barista> = new Map();
  private maxBaristas: number;
  private roleManager: RoleManager;

  constructor(maxBaristas: number = 4, roleManager?: RoleManager) {
    super();
    this.maxBaristas = maxBaristas;
    this.roleManager = roleManager || new RoleManager();
  }

  /**
   * Create a new Barista with Role support
   * Backward compatibility: if roleId not provided, uses default generic-agent role
   */
  createBarista(roleId?: string, provider: ProviderType = 'claude-code'): Barista {
    if (this.baristas.size >= this.maxBaristas) {
      throw new Error(`Maximum baristas (${this.maxBaristas}) reached`);
    }

    const role = this.resolveRole(roleId);

    const barista: Barista = {
      id: this.generateId(),
      status: BaristaStatus.IDLE,
      currentOrderId: null,
      provider,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      ...(role ? { role: role.id } : {}),
    };

    this.baristas.set(barista.id, barista);
    this.emitEvent(EventType.BARISTA_CREATED, barista.id, barista);

    return barista;
  }

  /**
   * Resolve role based on ID or fallback to default
   */
  private resolveRole(roleId?: string): Role | null {
    if (roleId) {
      const role = this.roleManager.loadRole(roleId);
      if (!role) {
        throw new Error(`Role '${roleId}' not found`);
      }
      return role;
    }

    // Backward compatibility: try default generic-agent role
    return this.roleManager.loadRole('generic-agent');
  }

  /**
   * Update Barista status
   */
  updateBaristaStatus(baristaId: string, status: BaristaStatus, orderId?: string | null): void {
    const barista = this.baristas.get(baristaId);
    if (!barista) {
      throw new Error(`Barista ${baristaId} not found`);
    }

    barista.status = status;
    barista.lastActivityAt = new Date();

    if (orderId !== undefined) {
      barista.currentOrderId = orderId;
    }

    this.emitEvent(EventType.BARISTA_STATUS_CHANGED, baristaId, { status, orderId });
  }

  /**
   * Get Barista by ID
   */
  getBarista(baristaId: string): Barista | null {
    return this.baristas.get(baristaId) || null;
  }

  /**
   * List all Baristas
   */
  listBaristas(): Barista[] {
    return Array.from(this.baristas.values());
  }

  /**
   * Remove Barista
   */
  removeBarista(baristaId: string): boolean {
    const barista = this.baristas.get(baristaId);
    if (!barista) {
      return false;
    }

    this.baristas.delete(baristaId);
    this.emitEvent(EventType.BARISTA_REMOVED, baristaId, barista);
    return true;
  }

  /**
   * Get Barista count
   */
  getBaristaCount(): number {
    return this.baristas.size;
  }

  /**
   * Get available Baristas (IDLE status)
   */
  getAvailableBaristas(): Barista[] {
    return this.listBaristas().filter(barista => barista.status === BaristaStatus.IDLE);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `barista-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Emit event with type safety
   */
  private emitEvent(type: EventType, baristaId: string, data: any): void {
    const event: BaristaEvent = {
      type,
      timestamp: new Date(),
      baristaId,
      data,
    };
    this.emit('barista-event', event);
  }
}
