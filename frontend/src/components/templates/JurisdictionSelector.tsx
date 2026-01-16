'use client';

import { useState, useEffect } from 'react';
import { MapPin, Loader2, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import type { JurisdictionSummary } from '@/types';

interface JurisdictionSelectorProps {
  value?: string;
  onChange: (jurisdictionId: string) => void;
  showOnlyIfMultiple?: boolean;
  className?: string;
}

export function JurisdictionSelector({
  value,
  onChange,
  showOnlyIfMultiple = true,
  className = '',
}: JurisdictionSelectorProps) {
  const [jurisdictions, setJurisdictions] = useState<JurisdictionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function loadJurisdictions() {
      try {
        const response = await api.get<JurisdictionSummary[]>('/jurisdictions');
        setJurisdictions(response);

        // Seleccionar automaticamente si solo hay una o si no hay seleccion
        if (response.length > 0 && !value) {
          onChange(response[0].id);
        }
      } catch (err) {
        console.error('Error loading jurisdictions:', err);
      } finally {
        setLoading(false);
      }
    }
    loadJurisdictions();
  }, []);

  // No mostrar si solo hay una jurisdiccion y showOnlyIfMultiple es true
  if (showOnlyIfMultiple && jurisdictions.length <= 1) {
    return null;
  }

  const selectedJurisdiction = jurisdictions.find((j) => j.id === value);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-gray-500 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Cargando...</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Jurisdiccion
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900">
            {selectedJurisdiction?.name || 'Seleccionar jurisdiccion'}
          </span>
          {selectedJurisdiction?.province && (
            <span className="text-gray-500 text-sm">
              ({selectedJurisdiction.province})
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            {jurisdictions.map((jurisdiction) => (
              <button
                key={jurisdiction.id}
                type="button"
                onClick={() => {
                  onChange(jurisdiction.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  value === jurisdiction.id ? 'bg-blue-50' : ''
                }`}
              >
                <MapPin
                  className={`w-4 h-4 ${
                    value === jurisdiction.id ? 'text-blue-500' : 'text-gray-400'
                  }`}
                />
                <div>
                  <span
                    className={`font-medium ${
                      value === jurisdiction.id ? 'text-blue-700' : 'text-gray-900'
                    }`}
                  >
                    {jurisdiction.name}
                  </span>
                  {jurisdiction.province && (
                    <span className="text-gray-500 text-sm ml-2">
                      {jurisdiction.province}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
