import { useAuthStore } from '@/stores/auth.store';
import type {
  AuditEvent,
  AuthResponse,
  ComplianceReport,
  Document,
  Location,
  Obligation,
  ObligationDashboard,
  ObligationReportItem,
  Organization,
  OrganizationMember,
  OrganizationStats,
  PaginatedResponse,
  Review,
  Role,
  Task,
  TaskItem,
  UserProfile,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
  // Internal flag to prevent infinite refresh-retry loops
  __retried?: boolean;
}

class ApiError extends Error {
  public errors?: Array<{ field?: string; message: string }>;

  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: Array<{ field?: string; message: string }>
  ) {
    super(message);
    this.errors = details;
    this.name = 'ApiError';
  }
}

// Track if we're currently refreshing to avoid multiple refresh calls
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

function unwrapApiResponse<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if ('data' in record) {
      // Paginated responses already include meta; keep them intact.
      if ('meta' in record) {
        return payload as T;
      }
      return record.data as T;
    }
  }
  return payload as T;
}

/**
 * Attempt to refresh the access token using the httpOnly refresh cookie
 */
async function refreshAccessToken(): Promise<string | null> {
  const store = useAuthStore.getState();
  if (!store.user) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      // Refresh failed, logout user
      store.logout();
      return null;
    }

    const data = await response.json();
    const payload = unwrapApiResponse<AuthResponse>(data);
    store.setAuth(payload.user, payload.accessToken);
    return payload.accessToken;
  } catch {
    store.logout();
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidAccessToken(): Promise<string | null> {
  const store = useAuthStore.getState();

  // If we have an access token in memory, use it
  if (store.accessToken) {
    return store.accessToken;
  }

  // No access token: try to refresh via cookie (avoid multiple simultaneous refresh calls)
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = refreshAccessToken();

  try {
    const token = await refreshPromise;
    return token;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, skipAuth, __retried, ...fetchOptions } = options;

  // Build URL with query params
  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Get token from store (with auto-refresh if needed)
  const token = skipAuth ? null : await getValidAccessToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...fetchOptions.headers,
  };

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    const payloadError =
      data && typeof data === 'object' && 'error' in data
        ? (data as { error?: { code?: string; message?: string; details?: Array<{ field?: string; message: string }> } }).error
        : undefined;
    const message = payloadError?.message || (data as { message?: string })?.message || 'Error en la solicitud';
    const details = payloadError?.details || (data as { errors?: Array<{ field?: string; message: string }> })?.errors;
    // If 401 and we have a refresh token, try to refresh and retry
    if (response.status === 401 && !skipAuth && !__retried) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Retry the request once with new token
        return request(endpoint, { ...options, skipAuth: false, __retried: true });
      }
    }
    throw new ApiError(response.status, message, payloadError?.code, details);
  }

  return unwrapApiResponse<T>(data);
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<AuthResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      }
    ),

  register: (email: string, fullName: string, password: string) =>
    request<AuthResponse>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, fullName, password }),
        skipAuth: true,
      }
    ),
  forgotPassword: (email: string) =>
    request<{ message: string }>(
      '/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
        skipAuth: true,
      }
    ),
  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>(
      '/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
        skipAuth: true,
      }
    ),

  refresh: () =>
    request<AuthResponse>(
      '/auth/refresh',
      {
        method: 'POST',
        skipAuth: true,
      }
    ),

  logout: () =>
    request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  getProfile: () =>
    request<UserProfile>('/auth/profile'),

  acceptInvitation: (token: string, fullName?: string, password?: string) =>
    request<AuthResponse>(
      '/auth/accept-invitation',
      {
        method: 'POST',
        body: JSON.stringify({ token, fullName, password }),
        skipAuth: true,
      }
    ),
};

// Organizations
export const organizations = {
  list: (page = 1, limit = 20) =>
    request<PaginatedResponse<Organization>>('/organizations', { params: { page, limit } }),

  get: (id: string) => request<Organization>(`/organizations/${id}`),

  create: (data: {
    cuit: string;
    name: string;
    plan?: Organization['plan'];
    thresholdYellowDays?: number;
    thresholdRedDays?: number;
    jurisdictionId?: string;
  }) =>
    request<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{
    cuit: string;
    name: string;
    plan?: Organization['plan'];
    thresholdYellowDays?: number;
    thresholdRedDays?: number;
    jurisdictionId?: string;
  }>) =>
    request<Organization>(`/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getStats: (id: string) => request<OrganizationStats>(`/organizations/${id}/stats`),

  getMembers: (id: string) => request<OrganizationMember[]>(`/organizations/${id}/members`),

  inviteMember: (orgId: string, email: string, role: Role) =>
    request<{ token: string }>(`/organizations/${orgId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
};

// Locations
export const locations = {
  list: (orgId: string, page = 1, limit = 20) =>
    request<PaginatedResponse<Location>>(`/organizations/${orgId}/locations`, { params: { page, limit } }),

  get: (orgId: string, locId: string) =>
    request<Location>(`/organizations/${orgId}/locations/${locId}`),

  create: (orgId: string, data: Pick<Location, 'name' | 'address' | 'rubric'>) =>
    request<Location>(`/organizations/${orgId}/locations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (orgId: string, locId: string, data: Partial<Pick<Location, 'name' | 'address' | 'rubric' | 'active'>>) =>
    request<Location>(`/organizations/${orgId}/locations/${locId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Obligations
export const obligations = {
  list: (orgId: string, params?: { page?: number; limit?: number; status?: string; type?: string; locationId?: string }) =>
    request<PaginatedResponse<Obligation>>(`/organizations/${orgId}/obligations`, { params }),

  get: (orgId: string, oblId: string) =>
    request<Obligation>(`/organizations/${orgId}/obligations/${oblId}`),

  getDashboard: (orgId: string) =>
    request<ObligationDashboard>(`/organizations/${orgId}/obligations/dashboard`),

  getCalendar: (orgId: string, startDate: string, endDate: string) =>
    request<Obligation[]>(`/organizations/${orgId}/obligations/calendar`, {
      params: { startDate, endDate },
    }),

  create: (orgId: string, data: Record<string, unknown>) =>
    request<Obligation>(`/organizations/${orgId}/obligations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (orgId: string, oblId: string, data: Record<string, unknown>) =>
    request<Obligation>(`/organizations/${orgId}/obligations/${oblId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateStatus: (orgId: string, oblId: string, status: string) =>
    request<Obligation>(`/organizations/${orgId}/obligations/${oblId}/status`, {
      method: 'PATCH',
      params: { status },
    }),

  delete: (orgId: string, oblId: string) =>
    request<void>(`/organizations/${orgId}/obligations/${oblId}`, {
      method: 'DELETE',
    }),
};

// Tasks
export const tasks = {
  list: (orgId: string, params?: { page?: number; limit?: number; obligationId?: string; status?: string }) =>
    request<PaginatedResponse<Task>>(`/organizations/${orgId}/tasks`, { params }),

  get: (orgId: string, taskId: string) =>
    request<Task>(`/organizations/${orgId}/tasks/${taskId}`),

  create: (orgId: string, data: Record<string, unknown>) =>
    request<Task>(`/organizations/${orgId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (orgId: string, taskId: string, data: Record<string, unknown>) =>
    request<Task>(`/organizations/${orgId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  toggleItem: (orgId: string, taskId: string, itemId: string) =>
    request<TaskItem>(`/organizations/${orgId}/tasks/${taskId}/items/${itemId}/toggle`, {
      method: 'POST',
    }),
};

// Documents
export const documents = {
  list: (orgId: string, params?: { page?: number; limit?: number; obligationId?: string; taskId?: string }) =>
    request<PaginatedResponse<Document>>(`/organizations/${orgId}/documents`, { params }),

  get: (orgId: string, docId: string) =>
    request<Document>(`/organizations/${orgId}/documents/${docId}`),

  getUploadUrl: (orgId: string, fileName: string, mimeType: string) =>
    request<{ uploadUrl: string; fileKey: string }>(`/organizations/${orgId}/documents/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ fileName, mimeType }),
    }),

  register: (orgId: string, data: { fileName: string; mimeType: string; sizeBytes: number; fileKey: string; obligationId?: string; taskId?: string }) =>
    request<Document>(`/organizations/${orgId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (orgId: string, docId: string) =>
    request<void>(`/organizations/${orgId}/documents/${docId}`, {
      method: 'DELETE',
    }),
};

// Reviews
export const reviews = {
  list: (orgId: string, obligationId: string, params?: { page?: number; limit?: number }) =>
    request<PaginatedResponse<Review>>(`/organizations/${orgId}/reviews/obligation/${obligationId}`, { params }),

  getPending: (orgId: string, params?: { page?: number; limit?: number }) =>
    request<PaginatedResponse<Review>>(`/organizations/${orgId}/reviews/pending`, { params }),

  create: (orgId: string, data: { obligationId: string; status: string; comment?: string }) =>
    request<Review>(`/organizations/${orgId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Audit
export const audit = {
  list: (orgId: string, params?: { page?: number; limit?: number; action?: string; entityType?: string; fromDate?: string; toDate?: string }) =>
    request<PaginatedResponse<AuditEvent>>(`/organizations/${orgId}/audit`, { params }),
};

// Reports
export const reports = {
  getCompliance: (orgId: string, params?: { fromDate?: string; toDate?: string; locationId?: string }) =>
    request<ComplianceReport>(`/organizations/${orgId}/reports/compliance`, { params }),

  getObligations: (orgId: string, params?: { fromDate?: string; toDate?: string; locationId?: string }) =>
    request<ObligationReportItem[]>(`/organizations/${orgId}/reports/obligations`, { params }),

  exportCsv: (orgId: string, params?: { fromDate?: string; toDate?: string; locationId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const queryString = searchParams.toString();
    return `${API_URL}/organizations/${orgId}/reports/export/csv${queryString ? `?${queryString}` : ''}`;
  },
};

// Generic helpers (legacy-style usage)
export const api = {
  get: <T>(endpoint: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),

  patch: <T>(endpoint: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),

  delete: <T>(endpoint: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};

export { ApiError };
