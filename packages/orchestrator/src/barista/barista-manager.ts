/**
 * Barista Manager with Role Integration
 * Phase 2: Role-based Barista creation with backward compatibility
 */

import { Barista, BaristaStatus, ProviderType, EventType, BaristaEvent } from '@codecafe/core';
import { EventEmitter } from 'events';
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
  createBarista(roleId?: string, provider?: ProviderType): Barista {
    if (this.baristas.size >= this.maxBaristas) {
      throw new Error(`Maximum baristas (${this.maxBaristas}) reached`);
    }

    let role: Role | null = null;
    let finalProvider: ProviderType;

    // Determine role and provider
    if (roleId) {
      role = this.roleManager.loadRole(roleId);
      if (!role) {
        throw new Error(`Role '${roleId}' not found`);
      }
      finalProvider = provider || 'claude-code'; // Default provider
    } else {
      // Backward compatibility: use default generic-agent role
      role = this.roleManager.loadRole('generic-agent');
      if (!role) {
        // Fallback to basic barista without role
        return this.createLegacyBarista(provider || 'claude-code');
      }
      finalProvider = provider || 'claude-code';
    }

    const barista: Barista = {
      id: this.generateId(),
      status: BaristaStatus.IDLE,
      currentOrderId: null,
      provider: finalProvider,
      role: role.id, // Store role ID for reference
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.baristas.set(barista.id, barista);
    this.emitEvent(EventType.BARISTA_CREATED, barista.id, barista);

    return barista;
  }

  /**
   * Legacy Barista creation (for backward compatibility)
   */
  private createLegacyBarista(provider: ProviderType): Barista {
    const barista: Barista = {
      id: this.generateId(),
      status: BaristaStatus.IDLE,
      currentOrderId: null,
      provider,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.baristas.set(barista.id, barista);
    this.emitEvent(EventType.BARISTA_CREATED, barista.id, barista);

    return barista;
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
    return Array.from(this.baristas.values()).filter(b => b.status === BaristaStatus.IDLE);
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