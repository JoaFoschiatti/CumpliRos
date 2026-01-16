// Auth types
export interface User {
  id: string;
  email: string;
  fullName: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface UserProfile extends User {
  organizations: OrganizationMembership[];
}

// Jurisdiction types
export interface Jurisdiction {
  id: string;
  code: string;
  name: string;
  country: string;
  province?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  templateCount?: number;
  organizationCount?: number;
}

export interface JurisdictionSummary {
  id: string;
  code: string;
  name: string;
  province?: string;
}

// Organization types
export interface Organization {
  id: string;
  cuit: string;
  name: string;
  jurisdictionId?: string;
  jurisdiction?: JurisdictionSummary;
  plan: 'BASIC' | 'PROFESSIONAL' | 'STUDIO';
  thresholdYellowDays: number;
  thresholdRedDays: number;
  active: boolean;
  createdAt: string;
  _count?: {
    locations: number;
    obligations: number;
  };
}

export interface OrganizationMembership {
  id: string;
  name: string;
  cuit: string;
  role: Role;
}

export type Role = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'MANAGER';

// Location types
export interface Location {
  id: string;
  organizationId: string;
  name: string;
  address?: string;
  rubric?: string;
  active: boolean;
  createdAt: string;
  _count?: {
    obligations: number;
  };
}

// Obligation types
export type ObligationType =
  | 'TAX'
  | 'PERMIT'
  | 'INSURANCE'
  | 'INSPECTION'
  | 'DECLARATION'
  | 'RENEWAL'
  | 'OTHER';

export type ObligationStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'NOT_APPLICABLE';

export type TrafficLight = 'GREEN' | 'YELLOW' | 'RED';

export interface Obligation {
  id: string;
  organizationId: string;
  locationId?: string;
  title: string;
  description?: string;
  type: ObligationType;
  status: ObligationStatus;
  dueDate: string;
  recurrenceRule?: string;
  requiresReview: boolean;
  requiredEvidenceCount: number;
  ownerUserId: string;
  createdAt: string;
  trafficLight: TrafficLight;
  daysUntilDue: number;
  location?: {
    id: string;
    name: string;
  };
  owner?: {
    id: string;
    fullName: string;
    email: string;
  };
  _count?: {
    documents: number;
    tasks: number;
    reviews: number;
  };
}

export interface ObligationDashboard {
  total: number;
  overdue: number;
  red: number;
  yellow: number;
  green: number;
  completed: number;
  upcoming7Days: Obligation[];
  overdueList: Obligation[];
}

// Task types
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';

export interface TaskItem {
  id: string;
  taskId: string;
  description: string;
  done: boolean;
  order: number;
  createdAt: string;
}

export interface Task {
  id: string;
  obligationId: string;
  assignedToUserId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate?: string;
  createdAt: string;
  assignee?: {
    id: string;
    fullName: string;
    email: string;
  };
  obligation?: {
    id: string;
    title: string;
  };
  items: TaskItem[];
  progress: number;
}

// Document types
export interface Document {
  id: string;
  organizationId: string;
  obligationId?: string;
  taskId?: string;
  uploadedByUserId: string;
  fileName: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy?: {
    id: string;
    fullName: string;
    email: string;
  };
  signedUrl?: string;
}

// Review types
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Review {
  id: string;
  obligationId: string;
  reviewerUserId: string;
  status: ReviewStatus;
  comment?: string;
  createdAt: string;
  reviewer?: {
    id: string;
    fullName: string;
    email: string;
  };
  obligation?: {
    id: string;
    title: string;
  };
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Reports
export interface ComplianceReport {
  period: {
    from: string;
    to: string;
  };
  summary: {
    totalObligations: number;
    completed: number;
    pending: number;
    overdue: number;
    complianceRate: number;
  };
  byType: Array<{
    type: string;
    total: number;
    completed: number;
    complianceRate: number;
  }>;
  byLocation: Array<{
    locationId: string;
    locationName: string;
    total: number;
    completed: number;
    overdue: number;
    complianceRate: number;
  }>;
  timeline: Array<{
    date: string;
    completed: number;
    overdue: number;
  }>;
}

// Template types
export type Periodicity =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'ANNUAL'
  | 'BIENNIAL'
  | 'ONE_TIME';

export type TemplateSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ChecklistTemplateItem {
  id: string;
  description: string;
  order: number;
  isRequired: boolean;
}

export interface ObligationTemplate {
  id: string;
  jurisdictionId: string;
  templateKey: string;
  rubric: string;
  title: string;
  description?: string;
  type: ObligationType;
  defaultPeriodicity: Periodicity;
  defaultDueRule?: string;
  requiresReview: boolean;
  requiredEvidenceCount: number;
  severity: TemplateSeverity;
  references?: {
    links?: Array<{ url: string; title: string }>;
    notes?: string[];
  };
  version: number;
  changelog?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  checklistItems?: ChecklistTemplateItem[];
}

export interface TemplateSummary {
  id: string;
  templateKey: string;
  title: string;
  rubric: string;
  type: ObligationType;
  defaultPeriodicity: Periodicity;
  severity: TemplateSeverity;
  checklistItemCount: number;
}

export interface Rubric {
  rubric: string;
  displayName: string;
  templateCount: number;
}

export interface ApplyTemplatesRequest {
  rubric: string;
  jurisdictionId?: string;
  templateIds?: string[];
  locationId?: string;
  ownerUserId?: string;
}

export interface ApplyTemplatesResult {
  obligationsCreated: number;
  tasksCreated: number;
  obligationIds: string[];
}
