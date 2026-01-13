/**
 * Barista Manager Tests
 * Tests for Role integration and backward compatibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaristaManager } from '../barista/barista-manager';
import { RoleManager } from '../role/role-manager';
import { BaristaStatus } from '@codecafe/core';

// Mock RoleManager
vi.mock('../role/role-manager', () => ({
  RoleManager: vi.fn().mockImplementation(() => ({
    loadRole: vi.fn(),
  })),
}));

describe('BaristaManager', () => {
  let baristaManager: BaristaManager;
  let mockRoleManager: any;

  beforeEach(() => {
    mockRoleManager = {
      loadRole: vi.fn(),
    };

    baristaManager = new BaristaManager(4, mockRoleManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Role Integration', () => {
    it('should create barista with role', () => {
      const mockRole = {
        id: 'planner',
        name: 'Planner',
        output_schema: '',
        inputs: [],
        template: '',
      };

      mockRoleManager.loadRole.mockReturnValue(mockRole);

      const barista = baristaManager.createBarista('planner', 'claude-code');

      expect(barista).toBeDefined();
      expect(barista.id).toMatch(/^barista-/);
      expect(barista.provider).toBe('claude-code');
      expect(barista.role).toBe('planner');
      expect(barista.status).toBe(BaristaStatus.IDLE);
      expect(mockRoleManager.loadRole).toHaveBeenCalledWith('planner');
    });

    it('should throw error when role not found', () => {
      mockRoleManager.loadRole.mockReturnValue(null);

      expect(() => {
        baristaManager.createBarista('non-existent-role');
      }).toThrow("Role 'non-existent-role' not found");
    });

    it('should use default generic-agent role when no role specified', () => {
      const mockRole = {
        id: 'generic-agent',
        name: 'Generic Agent',
        output_schema: '',
        inputs: [],
        template: '',
      };

      mockRoleManager.loadRole.mockReturnValue(mockRole);

      const barista = baristaManager.createBarista();

      expect(barista).toBeDefined();
      expect(barista.role).toBe('generic-agent');
      expect(mockRoleManager.loadRole).toHaveBeenCalledWith('generic-agent');
    });
  });

  describe('Backward Compatibility', () => {
    it('should create legacy barista when generic-agent role not found', () => {
      mockRoleManager.loadRole.mockReturnValue(null);

      const barista = baristaManager.createBarista();

      expect(barista).toBeDefined();
      expect(barista.id).toMatch(/^barista-/);
      expect(barista.provider).toBe('claude-code');
      expect(barista.role).toBeUndefined(); // Legacy barista has no role
      expect(barista.status).toBe(BaristaStatus.IDLE);
    });

    it('should create barista with provider only (legacy mode)', () => {
      const barista = baristaManager.createBarista(undefined, 'codex');

      expect(barista).toBeDefined();
      expect(barista.provider).toBe('codex');
      // Role may be generic-agent or undefined depending on mock
    });
  });

  describe('Barista Management', () => {
    it('should enforce max baristas limit', () => {
      const smallManager = new BaristaManager(2, mockRoleManager);
      mockRoleManager.loadRole.mockReturnValue(null); // Use legacy mode

      // Create max baristas
      smallManager.createBarista(undefined, 'claude-code');
      smallManager.createBarista(undefined, 'claude-code');

      // Third should fail
      expect(() => {
        smallManager.createBarista(undefined, 'claude-code');
      }).toThrow('Maximum baristas (2) reached');
    });

    it('should update barista status', () => {
      mockRoleManager.loadRole.mockReturnValue(null);
      const barista = baristaManager.createBarista();

      baristaManager.updateBaristaStatus(barista.id, BaristaStatus.BUSY, 'order-123');

      const updatedBarista = baristaManager.getBarista(barista.id);
      expect(updatedBarista?.status).toBe(BaristaStatus.BUSY);
      expect(updatedBarista?.currentOrderId).toBe('order-123');
    });

    it('should list all baristas', () => {
      mockRoleManager.loadRole.mockReturnValue(null);

      baristaManager.createBarista(undefined, 'claude-code');
      baristaManager.createBarista(undefined, 'codex');

      const baristas = baristaManager.listBaristas();
      expect(baristas.length).toBe(2);
      expect(baristas[0].provider).toBe('claude-code');
      expect(baristas[1].provider).toBe('codex');
    });

    it('should get available baristas', () => {
      mockRoleManager.loadRole.mockReturnValue(null);

      const barista1 = baristaManager.createBarista(undefined, 'claude-code');
      const barista2 = baristaManager.createBarista(undefined, 'codex');

      // Make one busy
      baristaManager.updateBaristaStatus(barista1.id, BaristaStatus.BUSY, 'order-1');

      const available = baristaManager.getAvailableBaristas();
      expect(available.length).toBe(1);
      expect(available[0].id).toBe(barista2.id);
      expect(available[0].status).toBe(BaristaStatus.IDLE);
    });

    it('should remove barista', () => {
      mockRoleManager.loadRole.mockReturnValue(null);
      const barista = baristaManager.createBarista();

      const removed = baristaManager.removeBarista(barista.id);
      expect(removed).toBe(true);

      const found = baristaManager.getBarista(barista.id);
      expect(found).toBeNull();
    });

    it('should return false when removing non-existent barista', () => {
      const removed = baristaManager.removeBarista('non-existent-id');
      expect(removed).toBe(false);
    });

    it('should get barista count', () => {
      mockRoleManager.loadRole.mockReturnValue(null);

      expect(baristaManager.getBaristaCount()).toBe(0);

      baristaManager.createBarista();
      expect(baristaManager.getBaristaCount()).toBe(1);

      baristaManager.createBarista();
      expect(baristaManager.getBaristaCount()).toBe(2);
    });
  });

  describe('Event Emission', () => {
    it('should emit events on barista creation', () => {
      mockRoleManager.loadRole.mockReturnValue(null);

      const eventHandler = vi.fn();
      baristaManager.on('barista-event', eventHandler);

      const barista = baristaManager.createBarista();

      expect(eventHandler).toHaveBeenCalled();
      const event = eventHandler.mock.calls[0][0];
      expect(event.type).toBe('barista:created');
      expect(event.baristaId).toBe(barista.id);
      expect(event.data).toEqual(barista);
    });

    it('should emit events on status change', () => {
      mockRoleManager.loadRole.mockReturnValue(null);
      const barista = baristaManager.createBarista();

      const eventHandler = vi.fn();
      baristaManager.on('barista-event', eventHandler);

      baristaManager.updateBaristaStatus(barista.id, BaristaStatus.BUSY, 'order-123');

      expect(eventHandler).toHaveBeenCalled();
      const event = eventHandler.mock.calls[0][0];
      expect(event.type).toBe('barista:status-changed');
      expect(event.baristaId).toBe(barista.id);
      expect(event.data).toEqual({ status: BaristaStatus.BUSY, orderId: 'order-123' });
    });

    it('should emit events on barista removal', () => {
      mockRoleManager.loadRole.mockReturnValue(null);
      const barista = baristaManager.createBarista();

      const eventHandler = vi.fn();
      baristaManager.on('barista-event', eventHandler);

      baristaManager.removeBarista(barista.id);

      expect(eventHandler).toHaveBeenCalled();
      const event = eventHandler.mock.calls[0][0];
      expect(event.type).toBe('barista:removed');
      expect(event.baristaId).toBe(barista.id);
      expect(event.data).toEqual(barista);
    });
  });
});