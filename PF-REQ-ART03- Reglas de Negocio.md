# PF-REQ-ART03 — Reglas de Negocio

## RN-01 — Aislamiento multi-tenant
Todos los datos pertenecen a una **Organización (CUIT)**. Un usuario sólo puede acceder a organizaciones donde fue invitado y aceptó.

## RN-02 — Estados de obligación
Una obligación debe tener exactamente un estado válido:
- `Pendiente`
- `En curso`
- `Cumplida`
- `Vencida`
- `No aplica`

## RN-03 — Semáforo (riesgo)
El semáforo se calcula sobre obligaciones no cumplidas:
- **Verde:** vencimiento > T_amarillo
- **Amarillo:** vencimiento ≤ T_amarillo y > T_rojo
- **Rojo:** vencimiento ≤ T_rojo o estado `Vencida`

Valores por defecto:
- T_amarillo = 15 días
- T_rojo = 7 días

Los umbrales deben ser configurables por Organización.

## RN-04 — Alcance de obligación
Una obligación puede estar asociada a:
- **Organización** (aplica globalmente), o
- **Local** (aplica a un establecimiento específico).

## RN-05 — Responsables
Cada obligación debe tener:
- 1 responsable primario (usuario) y
- 0..N responsables secundarios.

## RN-06 — Evidencias mínimas
Una obligación puede exigir evidencias mínimas (N>=0). Si N>0, no se puede cerrar como `Cumplida` sin evidencias adjuntas.

## RN-07 — Revisión requerida
Si `requires_review = true`:
- Debe existir un evento de revisión `Aprobada`.
- No se permite cerrar la obligación sin aprobación.

## RN-08 — Rechazo con observaciones
Cuando una revisión se rechaza:
- Debe registrarse observación.
- La obligación vuelve a `En curso` si estaba en proceso de cierre.

## RN-09 — Auditoría obligatoria
Se auditan como mínimo:
- Alta/edición/baja de obligación
- Cambio de estado
- Asignaciones
- Subida/borrado de documento
- Aprobación/rechazo

## RN-10 — Periodicidad
Si la obligación es periódica:
- Al cerrar una ocurrencia, se debe generar la próxima (según regla definida) o programarse manualmente (MVP puede permitir ambas estrategias).

## RN-11 — Invitaciones
Las invitaciones a Contador/Gestor:
- Expiran (ej. 7 días por defecto).
- Requieren aceptación explícita.

## RN-12 — Retención documental
Los documentos deben conservarse por política de retención configurable (ej. 24 meses por defecto) salvo obligación legal superior.
