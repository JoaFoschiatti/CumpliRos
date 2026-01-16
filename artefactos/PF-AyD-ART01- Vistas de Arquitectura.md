# PF-AyD-ART01 — Vistas de Arquitectura

## 1. Decisiones arquitectónicas clave
- **Multi-tenant por Organización (CUIT):** aislamiento estricto a nivel de datos y API.
- **PWA mobile-first:** orientado a uso operativo desde el teléfono (dueños y administrativos).
- **API-first:** frontend desacoplado del backend.
- **Storage externo de documentos:** no almacenar blobs en DB.
- **Jobs asíncronos:** para notificaciones y tareas programadas.

---

## 2. Vista lógica (componentes)

```mermaid
flowchart LR
  UI[PWA Web/Mobile] --> API[Backend API]
  API --> DB[(PostgreSQL)]
  API --> OBJ[(Object Storage - S3 compatible)]
  API --> RED[(Redis)]
  API --> Q[(Job Queue)]
  Q --> MAIL[Email Provider]
  API --> OBS[Observabilidad (Logs/Métricas/Tracing)]
```

### Componentes
- **UI (PWA):** tablero, calendario, tareas, carga de evidencias, administración.
- **API:** autenticación, RBAC, dominios (obligaciones/tareas/documentos), auditoría.
- **DB:** persistencia transaccional multi-tenant.
- **Object Storage:** documentos y evidencias.
- **Redis:** caché, rate limit, sesiones/colas si aplica.
- **Job Queue:** ejecución diferida (recordatorios, recalcular semáforo).
- **Observabilidad:** logs estructurados, métricas y tracing.

---

## 3. Vista de desarrollo (módulos del backend)

- `auth` (registro, login, recuperación, tokens, sesiones)
- `rbac` (permisos por rol y por organización)
- `org` (organizaciones, invitaciones)
- `locations` (locales)
- `obligations` (obligaciones, periodicidad, semáforo)
- `tasks` (tareas, checklists, asignación)
- `documents` (subida, metadata, links firmados)
- `review` (aprobación/rechazo)
- `notifications` (emails, plantillas)
- `audit` (eventos, consulta)
- `reporting` (KPIs, exportaciones)

---

## 4. Vista de datos (principios)
- Clave primaria UUID.
- Todas las tablas multi-tenant incluyen `organization_id` (y opcionalmente `location_id`).
- Índices por `organization_id` + campos de consulta frecuente (`due_date`, `status`, `assigned_to`).
- Auditoría append-only.

---

## 5. Vista de despliegue (opciones)

### Opción A (recomendada para MVP SaaS):
- **Frontend:** Vercel / Cloudflare Pages / Netlify.
- **Backend:** Render / Fly.io / Railway / VPS con Docker.
- **DB:** Postgres administrado (Neon/Supabase/Railway/Render).
- **Storage:** S3 compatible (Cloudflare R2, Backblaze B2, AWS S3).
- **Email:** Resend / Postmark / SendGrid.

### Opción B (todo en VPS):
- Nginx reverse proxy + Docker Compose.
- Postgres + Redis + Backend.
- MinIO (S3 compatible) para documentos.

---

# 6. Tecnologías a utilizar (detalle exhaustivo)

> Este apartado es intencionalmente detallado para servir como base del PF y del diseño del producto.

## 6.1 Frontend (PWA)

### Lenguaje y framework
- **TypeScript** como lenguaje principal.
- **Next.js** (App Router) como framework React:
  - SSR/SSG donde aplique.
  - Rutas protegidas y middleware.
  - Optimización de bundle y performance.

### UI / Estilos
- **Tailwind CSS** (build local con PostCSS, sin CDN):
  - Design tokens (espaciado, tipografía, colores).
  - Componentes atómicos + composición.
- **Component library (opcional):** shadcn/ui (sobre Tailwind) para acelerar desarrollo.

### Manejo de estado y datos
- **TanStack Query (React Query)**:
  - Cache de requests.
  - Mutations y reintentos.
  - Invalidación por claves (orgId, obligación, etc.).
- Formularios con **React Hook Form** + validación con **Zod**.

### PWA
- **next-pwa** o integración manual con:
  - `manifest.json` (nombre, íconos, theme color).
  - Service Worker (cache de assets, estrategia network-first para API, cache-first para estáticos).
- Objetivo: uso fluido en mobile, instalación y acceso rápido.

### Calendario
- **FullCalendar** o **React Big Calendar**:
  - Vista mensual/semanal.
  - Drag/drop (post-MVP) o edición desde modal.
  - Filtros por local/responsable.

### Autenticación en frontend
- Tokens manejados con cookies HttpOnly (si se elige sesión/jwt con refresh) o estrategia según backend.
- Guardas de rutas por rol y organización.

### Testing frontend
- **Vitest** + **React Testing Library**.
- E2E con **Playwright** (flujos críticos).

---

## 6.2 Backend (API)

### Opción recomendada (robusta y ágil)
- **Node.js** + **TypeScript**.
- Framework API: **NestJS** (estructura modular) o **Fastify** + plugins.
  - NestJS es ideal si querés fuerte separación por módulos y escalabilidad.

### ORM / Acceso a datos
- **Prisma ORM**:
  - Migraciones.
  - Modelado claro.
  - Tipado end-to-end.
- Alternativa: **Drizzle ORM** (más liviano).

### Base de datos
- **PostgreSQL**:
  - Tablas multi-tenant con `organization_id`.
  - Índices compuestos (organization_id, due_date, status).
  - Constraints (FK, CHECK) para integridad.

### Autenticación y autorización
- **Auth**:
  - Registro/login con email y contraseña.
  - Hash con **Argon2** (preferido) o bcrypt.
  - Tokens JWT con refresh o sesiones (según preferencia).
- **RBAC**:
  - Roles: OWNER, ADMIN, ACCOUNTANT, MANAGER.
  - Guards/middlewares por endpoint.
  - Permisos finos por organización.

### Validación
- DTOs validados con **Zod** (compartible con frontend) o class-validator (NestJS).

### Seguridad API
- **Helmet** (cabeceras seguras).
- **CORS** configurado por dominio.
- **Rate limiting**:
  - Por IP y por usuario (Redis).
- **Protección de subida de archivos**:
  - Límite de tamaño.
  - Lista blanca de MIME.
  - Renombrado seguro.
  - Almacenamiento externo.

### Jobs y programación
- **BullMQ** (Redis) para colas:
  - Recordatorios por email.
  - Recalcular estados semáforo.
  - Limpieza/retención documental.
- Cron con **node-cron** o scheduler de plataforma.

### Email
- Proveedor: **Resend** / **Postmark** / **SendGrid**.
- Plantillas: **React Email** o MJML.
- Eventos:
  - “Obligación vence en X días”.
  - “Obligación vencida”.
  - “Revisión requerida/rechazada/aprobada”.

### Observabilidad backend
- Logs estructurados con **pino** o **winston**.
- Correlation IDs por request.
- Métricas con **prom-client** (Prometheus) (post-MVP).
- Tracing OpenTelemetry (post-MVP).

### Testing backend
- Unit tests: **Vitest** o Jest.
- Integration tests: supertest.
- Contract tests (opcional): OpenAPI.

---

## 6.3 Almacenamiento de documentos

### Storage
- **S3 compatible** (Cloudflare R2 / Backblaze B2 / AWS S3).
- Uso de:
  - Buckets por entorno (dev/staging/prod).
  - Rutas por tenant: `org/{organizationId}/...`

### Acceso a archivos
- **Signed URLs** (pre-signed):
  - Subida directa desde frontend (opcional) o via backend.
  - Descarga temporal.
- Metadata en DB, archivo en storage.

### Antivirus (post-MVP)
- Integración con **ClamAV** (en pipeline) si se eleva el riesgo.

---

## 6.4 Infraestructura y DevOps

### Contenerización
- **Docker** para backend y servicios (Redis, etc.).
- **Docker Compose** para dev local.

### CI/CD
- **GitHub Actions**:
  - Lint + tests.
  - Build.
  - Deploy automatizado a staging.

### Entornos
- **Dev** (local), **Staging**, **Prod**.
- Variables por entorno (secrets).

### Reverse proxy / TLS
- En VPS: **Nginx** con TLS (Let’s Encrypt).

---

## 6.5 Estándares de API
- **OpenAPI/Swagger**:
  - Documentación de endpoints.
  - Versionado: `/api/v1/...`
- Respuestas consistentes:
  - `data`, `error`, `meta`.

---

## 6.6 Alternativa tecnológica (PHP, si querés alinearte a tu stack actual)

> Si tu preferencia es PHP (por tu experiencia en PWA + PHP/MySQL), se puede mantener el diseño con:

- Backend: **Laravel** (PHP 8.2+)
  - Auth: Laravel Sanctum.
  - Jobs: queues + scheduler.
  - Storage: Flysystem S3.
- DB: PostgreSQL o MySQL (Postgres recomendado).
- Frontend: igual (Next.js) o Blade + Inertia.

---

## 7. Vista de escenarios (4+1)

### Escenario 1: Vencimiento próximo
1) Job diario recalcula semáforo.
2) Si obligación entra en amarillo/rojo, se dispara notificación.

### Escenario 2: Cierre con revisión
1) Admin sube evidencias.
2) Contador revisa y aprueba.
3) Sistema permite cerrar y audita el evento.

---

## 8. Consideraciones de escalabilidad
- Índices por tenant.
- Paginación y filtros.
- Storage externo.
- Jobs asíncronos.
