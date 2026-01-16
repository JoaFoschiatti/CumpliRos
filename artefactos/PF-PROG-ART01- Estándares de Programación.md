# PF-PROG-ART01 — Estándares de Programación

## 1. Control de versiones
- Repositorio Git.
- Ramas:
  - `main`: estable (producción).
  - `develop`: integración.
  - `feature/<nombre>`: nuevas funcionalidades.
  - `hotfix/<nombre>`: correcciones urgentes.

## 2. Convención de commits
- Conventional Commits:
  - `feat:` nueva funcionalidad
  - `fix:` corrección
  - `refactor:` refactor sin cambios funcionales
  - `test:` cambios en pruebas
  - `docs:` documentación
  - `chore:` tareas de mantenimiento

## 3. Estándares de código (generales)
- Tipado estricto (TypeScript `strict: true`).
- Nombres:
  - Variables/funciones: `camelCase`.
  - Clases/tipos: `PascalCase`.
  - Constantes: `UPPER_SNAKE_CASE`.
  - DB: `snake_case`.
- Linters/format:
  - ESLint + Prettier.

## 4. Arquitectura backend
- Capas:
  - Controller/Route → Service → Repository/DAO.
- Validación en borde (DTO/Schema).
- Errores estandarizados:
  - Estructura `{ error: { code, message, details } }`.

## 5. API guidelines
- Versionado: `/api/v1`.
- HTTP:
  - 200 OK
  - 201 Created
  - 400 Validation
  - 401 Unauthorized
  - 403 Forbidden
  - 404 Not Found
  - 409 Conflict
  - 500 Server Error
- Paginación:
  - `limit`, `cursor` o `page`/`pageSize`.

## 6. Seguridad (mínimos)
- Contraseñas: Argon2/bcrypt.
- RBAC en cada endpoint.
- Aislamiento tenant obligatorio.
- Subida de archivos: validar MIME, tamaño, sanitizar nombre, storage externo.

## 7. Frontend standards
- Componentes desacoplados y reutilizables.
- Formularios: React Hook Form + Zod.
- Accesibilidad básica: labels, foco, navegación.

## 8. Testing standards
- Unit: servicios críticos.
- Integration: endpoints críticos.
- E2E: flujo “obligación → evidencia → revisión → cierre”.

## 9. Documentación
- README con setup local.
- OpenAPI/Swagger.
- ADR (Architecture Decision Records) para decisiones importantes.
