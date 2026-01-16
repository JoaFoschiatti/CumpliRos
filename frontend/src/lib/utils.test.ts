import { describe, it, expect } from 'vitest';
import {
  cn,
  formatDate,
  formatDateTime,
  formatFileSize,
  getTrafficLightColor,
  getStatusLabel,
  getTypeLabel,
  getRoleLabel,
} from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      const result = cn('foo', 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', true && 'active', false && 'hidden');
      expect(result).toBe('base active');
    });

    it('should handle tailwind conflicts', () => {
      const result = cn('p-4', 'p-2');
      expect(result).toBe('p-2');
    });
  });

  describe('formatDate', () => {
    it('should format date string', () => {
      const result = formatDate('2024-01-15');
      expect(result).toContain('2024');
      expect(result).toContain('15');
    });

    it('should format Date object', () => {
      const result = formatDate(new Date('2024-01-15'));
      expect(result).toContain('2024');
    });
  });

  describe('formatDateTime', () => {
    it('should include time in formatted output', () => {
      const result = formatDateTime('2024-01-15T10:30:00');
      expect(result).toContain('2024');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('formatFileSize', () => {
    it('should return 0 Bytes for 0', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(formatFileSize(512)).toBe('512 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(2048)).toBe('2 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('getTrafficLightColor', () => {
    it('should return green class for GREEN', () => {
      expect(getTrafficLightColor('GREEN')).toBe('bg-green-500');
    });

    it('should return yellow class for YELLOW', () => {
      expect(getTrafficLightColor('YELLOW')).toBe('bg-yellow-500');
    });

    it('should return red class for RED', () => {
      expect(getTrafficLightColor('RED')).toBe('bg-red-500');
    });

    it('should return gray class for unknown', () => {
      expect(getTrafficLightColor('UNKNOWN')).toBe('bg-gray-500');
    });
  });

  describe('getStatusLabel', () => {
    it('should return Spanish label for PENDING', () => {
      expect(getStatusLabel('PENDING')).toBe('Pendiente');
    });

    it('should return Spanish label for IN_PROGRESS', () => {
      expect(getStatusLabel('IN_PROGRESS')).toBe('En curso');
    });

    it('should return Spanish label for COMPLETED', () => {
      expect(getStatusLabel('COMPLETED')).toBe('Cumplida');
    });

    it('should return Spanish label for OVERDUE', () => {
      expect(getStatusLabel('OVERDUE')).toBe('Vencida');
    });

    it('should return original value for unknown status', () => {
      expect(getStatusLabel('CUSTOM')).toBe('CUSTOM');
    });
  });

  describe('getTypeLabel', () => {
    it('should return Spanish label for TAX', () => {
      expect(getTypeLabel('TAX')).toBe('Impuestos');
    });

    it('should return Spanish label for PERMIT', () => {
      expect(getTypeLabel('PERMIT')).toBe('Habilitaciones');
    });

    it('should return Spanish label for INSURANCE', () => {
      expect(getTypeLabel('INSURANCE')).toBe('Seguros');
    });

    it('should return original value for unknown type', () => {
      expect(getTypeLabel('CUSTOM')).toBe('CUSTOM');
    });
  });

  describe('getRoleLabel', () => {
    it('should return Spanish label for OWNER', () => {
      expect(getRoleLabel('OWNER')).toBe('Propietario');
    });

    it('should return Spanish label for ADMIN', () => {
      expect(getRoleLabel('ADMIN')).toBe('Administrador');
    });

    it('should return Spanish label for ACCOUNTANT', () => {
      expect(getRoleLabel('ACCOUNTANT')).toBe('Contador');
    });

    it('should return Spanish label for MANAGER', () => {
      expect(getRoleLabel('MANAGER')).toBe('Gestor');
    });

    it('should return original value for unknown role', () => {
      expect(getRoleLabel('CUSTOM')).toBe('CUSTOM');
    });
  });
});
