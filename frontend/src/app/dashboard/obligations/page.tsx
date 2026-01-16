'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { obligations } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter } from 'lucide-react';
import { cn, formatDate, getTrafficLightColor, getStatusLabel, getTypeLabel } from '@/lib/utils';

export default function ObligationsPage() {
  const { currentOrganizationId } = useAuthStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['obligations', currentOrganizationId, statusFilter],
    queryFn: () => obligations.list(currentOrganizationId!, { status: statusFilter || undefined }),
    enabled: !!currentOrganizationId,
  });

  if (!currentOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Selecciona una organización primero</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const obligationList = data?.data || [];
  const filteredList = obligationList.filter((o: any) =>
    o.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Obligaciones</h1>
          <p className="text-muted-foreground">Gestiona las obligaciones de tu organización</p>
        </div>
        <Link href="/dashboard/obligations/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva obligación
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar obligaciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="IN_PROGRESS">En curso</option>
          <option value="COMPLETED">Cumplida</option>
          <option value="OVERDUE">Vencida</option>
        </select>
      </div>

      {/* Obligations List */}
      {filteredList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No hay obligaciones</p>
            <Link href="/dashboard/obligations/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Crear obligación
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredList.map((obligation: any) => (
            <Card key={obligation.id} className="hover:border-primary transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={cn('w-4 h-4 rounded-full flex-shrink-0', getTrafficLightColor(obligation.trafficLight))} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{obligation.title}</h3>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {getTypeLabel(obligation.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>Vence: {formatDate(obligation.dueDate)}</span>
                      {obligation.location && <span>Local: {obligation.location.name}</span>}
                      {obligation.owner && <span>Resp: {obligation.owner.fullName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        obligation.status === 'COMPLETED' && 'bg-green-100 text-green-700',
                        obligation.status === 'OVERDUE' && 'bg-red-100 text-red-700',
                        obligation.status === 'IN_PROGRESS' && 'bg-blue-100 text-blue-700',
                        obligation.status === 'PENDING' && 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {getStatusLabel(obligation.status)}
                    </span>
                    {obligation.daysUntilDue < 0 ? (
                      <span className="text-xs text-red-500 font-medium">
                        {Math.abs(obligation.daysUntilDue)}d vencida
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {obligation.daysUntilDue}d
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
