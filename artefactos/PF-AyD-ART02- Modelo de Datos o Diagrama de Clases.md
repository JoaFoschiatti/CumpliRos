# PF-AyD-ART02 — Modelo de Datos o Diagrama de Clases

## 1. Objetivo
Definir el modelo de datos base para soportar multi-tenancy por Organización (CUIT), con locales, obligaciones, tareas, checklists, evidencias/documentos y auditoría.

## 2. Entidades principales
- Organization
- Location
- User
- UserOrg (membership con rol)
- Obligation
- Task
- TaskItem
- Document
- Review
- AuditEvent

## 3. ERD (Mermaid)

```mermaid
erDiagram
  ORGANIZATION ||--o{ LOCATION : has
  ORGANIZATION ||--o{ USER_ORG : has
  USER ||--o{ USER_ORG : joins

  ORGANIZATION ||--o{ OBLIGATION : defines
  LOCATION ||--o{ OBLIGATION : scopes

  OBLIGATION ||--o{ TASK : generates
  TASK ||--o{ TASK_ITEM : contains

  ORGANIZATION ||--o{ DOCUMENT : stores
  OBLIGATION ||--o{ DOCUMENT : evidences
  TASK ||--o{ DOCUMENT : attaches

  OBLIGATION ||--o{ REVIEW : requires
  USER ||--o{ REVIEW : performs

  ORGANIZATION ||--o{ AUDIT_EVENT : logs
  USER ||--o{ AUDIT_EVENT : performs

  ORGANIZATION {
    uuid id
    string cuit
    string name
    string plan
    int threshold_yellow_days
    int threshold_red_days
    datetime created_at
  }

  LOCATION {
    uuid id
    uuid organization_id
    string name
    string address
    string rubric
    bool active
    datetime created_at
  }

  USER {
    uuid id
    string email
    string full_name
    string password_hash
    bool active
    datetime created_at
  }

  USER_ORG {
    uuid id
    uuid user_id
    uuid organization_id
    string role
    datetime created_at
  }

  OBLIGATION {
    uuid id
    uuid organization_id
    uuid location_id
    string title
    string type
    string status
    date due_date
    string recurrence_rule
    bool requires_review
    int required_evidence_count
    uuid owner_user_id
    datetime created_at
  }

  TASK {
    uuid id
    uuid obligation_id
    uuid assigned_to_user_id
    string status
    datetime created_at
  }

  TASK_ITEM {
    uuid id
    uuid task_id
    string description
    bool done
    datetime created_at
  }

  DOCUMENT {
    uuid id
    uuid organization_id
    uuid obligation_id
    uuid task_id
    uuid uploaded_by_user_id
    string file_url
    string file_name
    string mime_type
    int size_bytes
    datetime uploaded_at
  }

  REVIEW {
    uuid id
    uuid obligation_id
    uuid reviewer_user_id
    string status
    string comment
    datetime created_at
  }

  AUDIT_EVENT {
    uuid id
    uuid organization_id
    uuid user_id
    string action
    string entity_type
    uuid entity_id
    json metadata
    datetime created_at
  }
```

## 4. Reglas de integridad (recomendadas)
- `organization_id` NOT NULL en todas las entidades multi-tenant.
- Índices:
  - `obligation(organization_id, due_date)`
  - `obligation(organization_id, status)`
  - `task(obligation_id)`
  - `document(organization_id, obligation_id)`
- Auditoría append-only.

## 5. Diagrama de clases (alternativo, conceptual)
- `Organization` agrega `Location`, `Obligation`, `AuditEvent`.
- `Obligation` compone `Task` y se asocia a `Document` y `Review`.
- `Task` compone `TaskItem` y referencia `Document`.
