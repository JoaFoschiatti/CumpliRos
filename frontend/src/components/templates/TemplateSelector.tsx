'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, FileText, AlertCircle, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import type { Rubric, TemplateSummary, ApplyTemplatesResult, JurisdictionSummary } from '@/types';

interface TemplateSelectorProps {
  organizationId: string;
  jurisdictionId?: string;
  onSuccess?: (result: ApplyTemplatesResult) => void;
  onError?: (error: string) => void;
}

const SEVERITY_COLORS = {
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

const PERIODICITY_LABELS: Record<string, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
  BIENNIAL: 'Bienal',
  ONE_TIME: 'Unica vez',
};

export function TemplateSelector({
  organizationId,
  jurisdictionId,
  onSuccess,
  onError,
}: TemplateSelectorProps) {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedRubric, setSelectedRubric] = useState<string | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingRubrics, setLoadingRubrics] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyTemplatesResult | null>(null);

  // Cargar rubros disponibles
  useEffect(() => {
    async function loadRubrics() {
      try {
        setLoadingRubrics(true);
        const params = jurisdictionId ? `?jurisdictionId=${jurisdictionId}` : '';
        const response = await api.get<Rubric[]>(`/templates/rubrics${params}`);
        setRubrics(response);
      } catch (err) {
        setError('Error al cargar rubros disponibles');
      } finally {
        setLoadingRubrics(false);
      }
    }
    loadRubrics();
  }, [jurisdictionId]);

  // Cargar plantillas cuando se selecciona un rubro
  useEffect(() => {
    if (!selectedRubric || !jurisdictionId) {
      setTemplates([]);
      return;
    }

    async function loadTemplates() {
      try {
        setLoading(true);
        const response = await api.get<TemplateSummary[]>(
          `/templates/jurisdiction/${jurisdictionId}/rubric/${selectedRubric}`
        );
        setTemplates(response);
        // Seleccionar todas las plantillas por defecto
        setSelectedTemplates(new Set(response.map((t) => t.id)));
      } catch (err) {
        setError('Error al cargar plantillas');
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, [selectedRubric, jurisdictionId]);

  const toggleTemplate = (templateId: string) => {
    const newSelected = new Set(selectedTemplates);
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId);
    } else {
      newSelected.add(templateId);
    }
    setSelectedTemplates(newSelected);
  };

  const selectAll = () => {
    setSelectedTemplates(new Set(templates.map((t) => t.id)));
  };

  const deselectAll = () => {
    setSelectedTemplates(new Set());
  };

  const handleApply = async () => {
    if (!selectedRubric || selectedTemplates.size === 0) return;

    try {
      setApplying(true);
      setError(null);

      const response = await api.post<ApplyTemplatesResult>(
        `/organizations/${organizationId}/templates/apply`,
        {
          rubric: selectedRubric,
          jurisdictionId,
          templateIds: Array.from(selectedTemplates),
        }
      );

      setResult(response);
      onSuccess?.(response);
    } catch (err: any) {
      const errorMsg = err.message || 'Error al aplicar plantillas';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setApplying(false);
    }
  };

  if (result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-green-800 mb-2">
          Obligaciones cargadas exitosamente
        </h3>
        <p className="text-green-700">
          Se crearon {result.obligationsCreated} obligaciones
          {result.tasksCreated > 0 && ` y ${result.tasksCreated} tareas con checklists`}.
        </p>
        <button
          onClick={() => setResult(null)}
          className="mt-4 text-sm text-green-600 hover:text-green-800 underline"
        >
          Cargar mas plantillas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de rubro */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecciona el rubro de tu negocio
        </label>
        {loadingRubrics ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : rubrics.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">
            No hay plantillas disponibles para tu jurisdiccion.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {rubrics.map((rubric) => (
              <button
                key={rubric.rubric}
                onClick={() => setSelectedRubric(rubric.rubric)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedRubric === rubric.rubric
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="font-medium text-gray-900">{rubric.displayName}</span>
                <span className="block text-sm text-gray-500 mt-1">
                  {rubric.templateCount} obligaciones
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista de plantillas */}
      {selectedRubric && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Obligaciones sugeridas para {rubrics.find((r) => r.rubric === selectedRubric)?.displayName}
            </label>
            <div className="flex gap-2 text-sm">
              <button
                onClick={selectAll}
                className="text-blue-600 hover:text-blue-800"
              >
                Seleccionar todas
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={deselectAll}
                className="text-blue-600 hover:text-blue-800"
              >
                Deseleccionar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">
              No hay plantillas disponibles para este rubro.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {templates.map((template) => (
                <label
                  key={template.id}
                  className={`flex items-start p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedTemplates.has(template.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTemplates.has(template.id)}
                    onChange={() => toggleTemplate(template.id)}
                    className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{template.title}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          SEVERITY_COLORS[template.severity]
                        }`}
                      >
                        {template.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{PERIODICITY_LABELS[template.defaultPeriodicity]}</span>
                      {template.checklistItemCount > 0 && (
                        <span>{template.checklistItemCount} items de checklist</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Boton aplicar */}
      {selectedRubric && templates.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleApply}
            disabled={applying || selectedTemplates.size === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              applying || selectedTemplates.size === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {applying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Aplicando...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Cargar {selectedTemplates.size} obligaciones
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
