'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { organizations } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building2, MapPin, FileCheck } from 'lucide-react';

export default function OrganizationsPage() {
  const { setCurrentOrganization, currentOrganizationId } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizations.list(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const orgList = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizaciones</h1>
          <p className="text-muted-foreground">Gestiona tus organizaciones y locales</p>
        </div>
        <Link href="/dashboard/organizations/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva organización
          </Button>
        </Link>
      </div>

      {orgList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tienes organizaciones</h3>
            <p className="text-muted-foreground mb-4">Crea tu primera organización para comenzar</p>
            <Link href="/dashboard/organizations/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Crear organización
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgList.map((org) => (
            <Card
              key={org.id}
              className={`cursor-pointer transition-colors hover:border-primary ${
                currentOrganizationId === org.id ? 'border-primary border-2' : ''
              }`}
              onClick={() => setCurrentOrganization(org.id)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{org.name}</span>
                  {currentOrganizationId === org.id && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                      Activa
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">CUIT: {org.cuit}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {org._count?.locations || 0} locales
                  </span>
                  <span className="flex items-center gap-1">
                    <FileCheck className="h-4 w-4" />
                    {org._count?.obligations || 0} obligaciones
                  </span>
                </div>
                <div className="pt-2">
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {org.plan}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
