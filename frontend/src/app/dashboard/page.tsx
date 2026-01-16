'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { obligations } from '@/lib/api';
import { TrafficLightCard } from '@/components/dashboard/traffic-light-card';
import { ObligationList } from '@/components/dashboard/obligation-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { currentOrganizationId, getCurrentOrganization } = useAuthStore();
  const currentOrg = getCurrentOrganization();

  const {
    data: dashboard,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', currentOrganizationId],
    queryFn: () => obligations.getDashboard(currentOrganizationId!),
    enabled: !!currentOrganizationId,
    refetchInterval: 60000, // Refresh every minute
  });

  if (!currentOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <h2 className="text-xl font-semibold">No tienes organizaciones</h2>
        <p className="text-muted-foreground">Crea una organización para comenzar</p>
        <Link href="/dashboard/organizations/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Crear organización
          </Button>
        </Link>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{currentOrg?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Link href="/dashboard/obligations/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nueva obligación
            </Button>
          </Link>
        </div>
      </div>

      {/* Traffic Light Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <TrafficLightCard
          title="Total"
          value={dashboard?.total || 0}
          color="gray"
          description="Obligaciones totales"
        />
        <TrafficLightCard
          title="Al día"
          value={dashboard?.green || 0}
          color="green"
          description="Más de 15 días"
        />
        <TrafficLightCard
          title="Próximas"
          value={dashboard?.yellow || 0}
          color="yellow"
          description="7-15 días"
        />
        <TrafficLightCard
          title="Urgentes"
          value={dashboard?.red || 0}
          color="red"
          description="Menos de 7 días"
        />
        <TrafficLightCard
          title="Vencidas"
          value={dashboard?.overdue || 0}
          color="red"
          description="Requieren atención"
        />
      </div>

      {/* Compliance Rate */}
      {dashboard && dashboard.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tasa de cumplimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-500 h-4 rounded-full transition-all"
                  style={{ width: `${Math.round((dashboard.completed / dashboard.total) * 100)}%` }}
                />
              </div>
              <span className="text-2xl font-bold">
                {Math.round((dashboard.completed / dashboard.total) * 100)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {dashboard.completed} de {dashboard.total} obligaciones cumplidas
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lists */}
      <div className="grid gap-6 md:grid-cols-2">
        <ObligationList
          title="Vencidas"
          obligations={dashboard?.overdueList || []}
          emptyMessage="No hay obligaciones vencidas"
        />
        <ObligationList
          title="Próximos 7 días"
          obligations={dashboard?.upcoming7Days || []}
          emptyMessage="No hay vencimientos próximos"
        />
      </div>
    </div>
  );
}
