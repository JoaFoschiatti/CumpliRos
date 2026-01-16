# PF-TEST-ART01 — Plan de Testing y Casos de Prueba

## 1. Objetivo
Asegurar que el MVP cumpla requisitos funcionales y no funcionales críticos: multi-tenant, RBAC, semáforo, flujo de evidencias y notificaciones.

## 2. Alcance
Incluye:
- Unit tests (servicios de negocio).
- Integration tests (API).
- E2E tests (flujos críticos).

## 3. Estrategia de pruebas

### 3.1 Unit tests
- Cálculo de semáforo.
- Transiciones de estado de obligación.
- Reglas de cierre con evidencias/revisión.
- RBAC helper/guards.

### 3.2 Integration tests
- Auth (login, refresh, recuperación si aplica).
- CRUD obligaciones.
- Subida de documentos y metadata.
- Revisión/aprobación.

### 3.3 E2E
- Flujo completo: crear obligación → tarea → subir evidencia → revisión → cerrar → verificar auditoría.

## 4. Entorno de testing
- DB dedicada de test.
- Storage separado (bucket o carpeta).
- Usuarios por rol (OWNER/ADMIN/ACCOUNTANT/MANAGER).

## 5. Datos de prueba
- Organización A y B para validar aislamiento.
- 1 local por organización.
- 5 obligaciones con vencimientos variados.

## 6. Casos de prueba

| ID | Caso | Precondición | Pasos | Resultado esperado |
|---|------|--------------|------|--------------------|
| TC-01 | Login válido | Usuario activo | Ingresar credenciales | Acceso OK, token/sesión válida |
| TC-02 | Login inválido | Usuario activo | Password incorrecta | 401, sin token |
| TC-03 | Aislamiento tenant | Org A y Org B | Usuario A consulta datos de B | 403 |
| TC-04 | Semáforo rojo | Obligación vence en 5 días | Consultar tablero | Rojo |
| TC-05 | Semáforo amarillo | Vence en 10 días | Consultar tablero | Amarillo |
| TC-06 | Crear obligación por local | Existe local | Alta obligación con location_id | Visible filtrando por local |
| TC-07 | Subir evidencia válida | Tarea creada | Subir PDF permitido | Documento asociado OK |
| TC-08 | Subir evidencia inválida | Tarea creada | Subir ejecutable | Rechazo por MIME/tamaño |
| TC-09 | Revisión requerida - rechazo | requires_review=true | Revisor rechaza con comentario | Estado en curso + observación |
| TC-10 | Revisión requerida - aprobación | Evidencia cargada | Revisor aprueba | Permite cerrar obligación |
| TC-11 | Cierre sin evidencias | required_evidence_count>0 | Marcar cumplida sin docs | Bloqueado, error validación |
| TC-12 | Notificación por vencimiento | Vence en 7 días | Ejecutar job | Email enviado a responsable |
| TC-13 | Auditoría de cambios | Obligación existente | Cambiar responsable | Evento audit creado |
| TC-14 | Exportación CSV | Datos existentes | Exportar reporte | Archivo descargable |

## 7. Criterios de salida
- 0 bugs críticos abiertos.
- Flujo E2E principal pasa en staging.
- Pruebas de aislamiento tenant y RBAC pasan.
