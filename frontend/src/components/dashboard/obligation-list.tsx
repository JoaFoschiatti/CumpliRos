'use client';

import { cn } from '@/lib/utils';
import { formatDate, getTrafficLightColor, getStatusLabel, getTypeLabel } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Obligation } from '@/types';

interface ObligationListProps {
  title: string;
  obligations: Obligation[];
  emptyMessage?: string;
}

export function ObligationList({ title, obligations, emptyMessage = 'No hay obligaciones' }: ObligationListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {obligations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {obligations.map((obligation) => (
              <div
                key={obligation.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className={cn('w-3 h-3 rounded-full flex-shrink-0', getTrafficLightColor(obligation.trafficLight))} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{obligation.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{getTypeLabel(obligation.type)}</span>
                    <span>•</span>
                    <span>Vence: {formatDate(obligation.dueDate)}</span>
                    {obligation.daysUntilDue < 0 ? (
                      <span className="text-red-500 font-medium">
                        ({Math.abs(obligation.daysUntilDue)} días vencida)
                      </span>
                    ) : (
                      <span>({obligation.daysUntilDue} días)</span>
                    )}
                  </div>
                </div>
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
