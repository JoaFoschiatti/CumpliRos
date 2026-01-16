# PF-PPMC-ART01 — Plan de Proyecto

## 1. Resumen ejecutivo
Proyecto para construir un **MVP** del SaaS “Panel de Cumplimiento Municipal Rosario” que permita gestionar obligaciones, vencimientos, tareas, evidencias documentales, revisión y reportes básicos, con enfoque multi-tenant.

## 2. Objetivos
- Implementar MVP productivo con seguridad y aislamiento multi-tenant.
- Validar con un piloto de 3 organizaciones (negocios) o 1 estudio contable con 3 clientes.
- Entregar documentación del PF y artefactos completos.

## 3. Alcance

### 3.1 Incluye (MVP)
- Organizaciones (CUIT), locales.
- Usuarios, roles, invitaciones.
- Obligaciones y vencimientos; semáforo.
- Calendario + tablero.
- Tareas/checklists.
- Documentos/evidencias + revisión.
- Notificaciones por email.
- Auditoría y reportes básicos.

### 3.2 Excluye (post-MVP)
- Integraciones automáticas con portales.
- WhatsApp oficial.
- OCR/IA sobre documentos.
- Facturación electrónica/contable.

## 4. Entregables
- Artefactos del PF (PF-NEG, PF-REQ, PF-PPMC, PF-AyD, PF-PROG, PF-TEST).
- Código fuente (frontend + backend + infra).
- Manual operativo breve (usuario y admin).

## 5. Metodología
- Iterativa incremental (sprints de 2 semanas).
- Backlog priorizado por valor y riesgo.
- Demo por sprint y aceptación con checklist.

## 6. Plan de trabajo y cronograma (10 semanas)

| Semana | Actividades | Resultados |
|---|---|---|
| 1–2 | Relevamiento + ERS + UC + RN + Modelo datos | Documentación base + backlog |
| 3–4 | Auth + tenants + RBAC + setup infra | Base segura + deploy inicial |
| 5–6 | Obligaciones + tablero + calendario | Funcionalidad core |
| 7 | Tareas/checklists + auditoría | Flujo operativo completo |
| 8 | Documentos + revisión + reportes + emails | MVP feature-complete |
| 9 | Testing integral + hardening seguridad | Estabilidad + correcciones |
| 10 | Piloto + ajustes + entrega final | Validación y cierre |

## 7. Recursos y roles
- Product Owner / Analista: responsable de requisitos y validación.
- Dev Full-Stack: implementación.
- QA: planificación y ejecución de pruebas.
- Usuarios piloto: negocio/estudio contable.

## 8. Gestión de riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---:|---:|---|
| Complejidad de obligaciones por rubro | Media | Media | Plantillas mínimas + configuración manual |
| Falta de pilotos | Media | Alta | Canal contadores/gestores; propuesta de valor clara |
| Fallas multi-tenant | Baja | Alta | Tests de aislamiento + revisiones RBAC |
| Subida de archivos insegura | Media | Alta | Validaciones estrictas + storage seguro |

## 9. Control de cambios
- Cada cambio de alcance debe registrarse con: motivo, impacto, prioridad y fecha.

## 10. Criterios de éxito
- 1) Flujo completo “obligación → tarea → evidencia → revisión → cierre”.
- 2) Tablero/cálculo de semáforo correcto.
- 3) Piloto real operando al menos 2 semanas con feedback.
