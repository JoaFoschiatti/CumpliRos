# PF-REQ-ART01 — Especificación de Requerimientos de Software (ERS/SRS)

## 1. Introducción

### 1.1 Propósito
Definir los requisitos funcionales y no funcionales del sistema **Panel de Cumplimiento Municipal Rosario** (en adelante, “el Sistema”), orientado a comercios y pymes con local físico que deben gestionar obligaciones, vencimientos y documentación de cumplimiento.

### 1.2 Alcance
El Sistema provee:
- Administración multi-tenant por **Organización (CUIT)**.
- Gestión de **locales**.
- Gestión de **usuarios y roles**.
- Gestión de **obligaciones** con vencimientos y semáforo.
- **Tareas/checklists** para ejecutar cumplimiento.
- **Repositorio documental** de evidencias.
- **Revisión/aprobación** opcional.
- **Notificaciones** (email en MVP).
- **Auditoría** y reportes básicos.

### 1.3 Definiciones
Ver `PF-REQ-ART04- Glosario`.

## 2. Visión general del producto

### 2.1 Contexto de uso
- El Dueño necesita visibilidad y alertas para evitar incumplimientos.
- El Administrativo carga documentación y ejecuta checklists.
- El Contador/Gestor opera como colaborador externo, con acceso restringido por invitación.

### 2.2 Objetivos de negocio
- Reducir costo de incumplimiento (tiempo, multas, interrupciones).
- Mejorar trazabilidad y control documental.
- Monetizar vía SaaS mensual por CUIT/local y plan “Estudio” multi-cliente.

## 3. Stakeholders y usuarios
- Dueño
- Administrativo
- Contador
- Gestor
- Administrador del SaaS

## 4. Requisitos funcionales (RF)

> Convención: RF-XX, con prioridad `Must/Should/Could`.

### 4.1 Gestión de Organizaciones y Locales
- **RF-01 (Must)**: Crear/editar/desactivar Organización (CUIT) y datos generales.
- **RF-02 (Must)**: Crear/editar/desactivar Locales asociados a una Organización.
- **RF-03 (Should)**: Parametrizar umbrales del semáforo por Organización.

### 4.2 Usuarios, roles y acceso
- **RF-04 (Must)**: Registro/login y recuperación de contraseña.
- **RF-05 (Must)**: Invitar usuarios a una Organización con rol.
- **RF-06 (Must)**: Control de acceso por rol (RBAC) y por tenant (aislamiento multi-tenant).
- **RF-07 (Should)**: Soportar 2FA (post-MVP).

### 4.3 Obligaciones y vencimientos
- **RF-08 (Must)**: CRUD de obligaciones (tipo, título, alcance organizacional o por local, fecha de vencimiento, periodicidad).
- **RF-09 (Must)**: Estados de obligación: Pendiente/En curso/Cumplida/Vencida/No aplica.
- **RF-10 (Must)**: Cálculo de semáforo por obligación en función de vencimiento y estado.
- **RF-11 (Should)**: Generación automática de próximos vencimientos para obligaciones periódicas.

### 4.4 Calendario y tablero
- **RF-12 (Must)**: Calendario con filtros por local/responsable/estado/tipo.
- **RF-13 (Must)**: Tablero semaforizado con KPIs (vencidas, próximas 7/15/30 días).
- **RF-14 (Could)**: Vista “timeline” semanal (post-MVP).

### 4.5 Tareas y checklists
- **RF-15 (Must)**: Generar tareas asociadas a obligaciones.
- **RF-16 (Must)**: Checklists con ítems marcables y responsables.
- **RF-17 (Should)**: Plantillas de checklists por rubro/tipo de obligación.

### 4.6 Evidencias y documentos
- **RF-18 (Must)**: Subir y asociar documentos a obligación/tarea.
- **RF-19 (Must)**: Versionado básico (múltiples evidencias por obligación).
- **RF-20 (Must)**: Metadatos mínimos: nombre, tipo, tamaño, fecha, usuario.
- **RF-21 (Should)**: Búsqueda por tags o texto (post-MVP).

### 4.7 Revisión y aprobación
- **RF-22 (Must)**: Configurar obligación con revisión requerida.
- **RF-23 (Must)**: Aprobación/rechazo con observaciones.
- **RF-24 (Must)**: Bloqueo de cierre si requiere revisión y no está aprobada.

### 4.8 Notificaciones
- **RF-25 (Must)**: Enviar emails por vencimientos próximos y obligaciones vencidas.
- **RF-26 (Should)**: Configurar frecuencia/umbrales de recordatorio.
- **RF-27 (Could)**: WhatsApp oficial/plantillas (post-MVP).

### 4.9 Auditoría y reportes
- **RF-28 (Must)**: Registrar auditoría para eventos críticos (cambios de estado, asignaciones, aprobaciones).
- **RF-29 (Must)**: Reportes básicos (cumplimiento mensual, obligaciones vencidas/próximas).
- **RF-30 (Should)**: Exportación CSV/PDF simple.

## 5. Requisitos no funcionales (RNF)

### 5.1 Seguridad
- **RNF-01**: Hash de contraseñas con Argon2 o bcrypt.
- **RNF-02**: RBAC obligatorio en endpoints y UI.
- **RNF-03**: Aislamiento estricto multi-tenant.
- **RNF-04**: Protección contra XSS/CSRF según esquema de autenticación.
- **RNF-05**: Subida de archivos con validación de MIME/tamaño y antivirus opcional (post-MVP).

### 5.2 Rendimiento
- **RNF-06**: Carga de tablero < 2s para 1.000 obligaciones.
- **RNF-07**: Operaciones de listado paginadas.

### 5.3 Disponibilidad y continuidad
- **RNF-08**: Backups diarios.
- **RNF-09**: Logs y métricas mínimas para diagnóstico.

### 5.4 Usabilidad
- **RNF-10**: Mobile-first, PWA instalable.
- **RNF-11**: Lenguaje claro, estados visibles, mínima fricción en carga de evidencias.

### 5.5 Mantenibilidad
- **RNF-12**: Arquitectura por capas y módulos.
- **RNF-13**: Cobertura de tests mínima para servicios críticos.

## 6. Reglas de negocio y trazabilidad
Las reglas de negocio están detalladas en `PF-REQ-ART03- Reglas de Negocio` y deberán trazarse contra RF, UC y casos de prueba.

## 7. Criterios de aceptación (ejemplos)
- Si una obligación vence en <= 7 días y no está Cumplida, debe figurar como Rojo.
- Si la obligación requiere revisión, no se puede cerrar sin estado de revisión Aprobada.
- Un usuario Contador/Gestor sólo ve organizaciones donde fue invitado.
