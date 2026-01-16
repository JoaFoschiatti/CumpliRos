# PF-NEG-ART01 — Proceso de Negocio (Diagrama de Actividad)

## 1. Objetivo del proceso
Establecer el proceso operativo estándar para **gestionar cumplimiento**, **vencimientos** y **evidencias documentales** de una Organización (CUIT) con uno o múltiples locales en Rosario, coordinando actores internos (dueño/administrativo) y externos (contador/gestor).

## 2. Alcance
Incluye:
- Alta de Organización, locales, usuarios y roles.
- Definición/carga de obligaciones (por plantilla o manual).
- Monitoreo de vencimientos (tablero semaforizado + calendario).
- Creación/ejecución de tareas y checklists.
- Recolección, carga y revisión de evidencias.
- Cierre de obligación (cumplida) y auditoría.

Excluye (MVP):
- Ejecución automática de trámites en portales municipales.
- Integración directa con AFIP/ARCA u otros organismos.

## 3. Actores
- **Dueño**: responsable final de cumplimiento.
- **Administrativo**: carga documentación, ejecuta tareas.
- **Contador**: asesora, revisa y valida evidencias cuando aplica.
- **Gestor**: ejecuta gestiones y aporta documentación.
- **Sistema**: calcula estados, genera recordatorios y auditoría.

## 4. Estados principales
- **Obligación**: `Pendiente`, `En curso`, `Cumplida`, `Vencida`, `No aplica`.
- **Tarea**: `Abierta`, `En progreso`, `Bloqueada`, `Finalizada`, `Cancelada`.
- **Revisión**: `No requerida`, `Pendiente`, `Aprobada`, `Rechazada`.

## 5. Diagrama de Actividad (Mermaid)

```mermaid
flowchart TD
  A([Inicio]) --> B[Alta/Selección de Organización (CUIT)]
  B --> C[Alta/Selección de Locales]
  C --> D[Alta/Invitación de Usuarios y Roles]
  D --> E[Configuración de Obligaciones]
  E --> E1{Origen de obligaciones}
  E1 -- Plantilla por rubro --> E2[Aplicar plantilla y ajustar parámetros]
  E1 -- Manual --> E3[Crear obligación: tipo, alcance, periodicidad]
  E2 --> F
  E3 --> F

  F[Generar calendario + tablero semáforo] --> G{¿Hay obligaciones próximas o vencidas?}
  G -- No --> F
  G -- Sí --> H[Crear tarea/checklist asociado]

  H --> I[Asignar responsable (Dueño/Admin/Contador/Gestor)]
  I --> J[Ejecutar checklist y recolectar documentación]
  J --> K[Subir evidencias (PDF/imagen/constancia/comprobante)]

  K --> L{¿Requiere revisión?}
  L -- No --> M[Marcar obligación Cumplida]
  L -- Sí --> N[Revisor valida evidencias]
  N --> O{¿Aprobado?}
  O -- No --> P[Rechazo con observaciones]
  P --> J
  O -- Sí --> M

  M --> Q[Registrar auditoría (quién, qué, cuándo)]
  Q --> R[Actualizar tablero/calendario]
  R --> F
```

## 6. Reglas operativas del proceso (resumen)
- El Sistema debe recalcular semáforo al menos diariamente y ante cambios relevantes.
- No se puede cerrar una obligación como `Cumplida` si requiere evidencias mínimas y estas no existen.
- Si una obligación vence en <= 7 días y no está cumplida, el estado semáforo debe ser `Rojo` (configurable).

## 7. Entradas / Salidas
**Entradas**:
- Datos de organización, locales y usuarios.
- Definición de obligaciones y vencimientos.
- Evidencias documentales.

**Salidas**:
- Tablero de cumplimiento.
- Calendario de vencimientos.
- Reportes y exportaciones.
- Auditoría de actividades.
