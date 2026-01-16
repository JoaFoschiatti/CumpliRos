import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getTrafficLightColor(trafficLight: string): string {
  switch (trafficLight) {
    case 'GREEN':
      return 'bg-green-500';
    case 'YELLOW':
      return 'bg-yellow-500';
    case 'RED':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pendiente',
    IN_PROGRESS: 'En curso',
    COMPLETED: 'Cumplida',
    OVERDUE: 'Vencida',
    NOT_APPLICABLE: 'No aplica',
    OPEN: 'Abierta',
    BLOCKED: 'Bloqueada',
    CANCELLED: 'Cancelada',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
  };
  return labels[status] || status;
}

export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    TAX: 'Impuestos',
    PERMIT: 'Habilitaciones',
    INSURANCE: 'Seguros',
    INSPECTION: 'Inspecciones',
    DECLARATION: 'Declaraciones',
    RENEWAL: 'Renovaciones',
    OTHER: 'Otros',
  };
  return labels[type] || type;
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    OWNER: 'Propietario',
    ADMIN: 'Administrador',
    ACCOUNTANT: 'Contador',
    MANAGER: 'Gestor',
  };
  return labels[role] || role;
}
