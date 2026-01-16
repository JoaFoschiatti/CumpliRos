const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: Array<{ code: string; message: string; field?: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

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

  // Get token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...fetchOptions.headers,
  };

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.message || 'Error en la solicitud', data.errors);
  }

  return data;
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: { id: string; email: string; fullName: string } }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    ),

  register: (email: string, fullName: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: { id: string; email: string; fullName: string } }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, fullName, password }),
      }
    ),

  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string; user: { id: string; email: string; fullName: string } }>(
      '/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }
    ),

  logout: (refreshToken: string) =>
    request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  getProfile: () =>
    request<{
      id: string;
      email: string;
      fullName: string;
      organizations: Array<{ id: string; name: string; cuit: string; role: string }>;
    }>('/auth/profile'),

  acceptInvitation: (token: string, fullName?: string, password?: string) =>
    request<{ accessToken: string; refreshToken: string; user: { id: string; email: string; fullName: string } }>(
      '/auth/accept-invitation',
      {
        method: 'POST',
        body: JSON.stringify({ token, fullName, password }),
      }
    ),
};

// Organizations
export const organizations = {
  list: (page = 1, limit = 20) =>
    request<any>('/organizations', { params: { page, limit } }),

  get: (id: string) => request<any>(`/organizations/${id}`),

  create: (data: { cuit: string; name: string; plan?: string; thresholdYellowDays?: number; thresholdRedDays?: number }) =>
    request<any>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ cuit: string; name: string; plan?: string; thresholdYellowDays?: number; thresholdRedDays?: number }>) =>
    request<any>(`/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getStats: (id: string) => request<any>(`/organizations/${id}/stats`),

  getMembers: (id: string) => request<any>(`/organizations/${id}/members`),

  inviteMember: (orgId: string, email: string, role: string) =>
    request<{ token: string }>(`/organizations/${orgId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
};

// Locations
export const locations = {
  list: (orgId: string, page = 1, limit = 20) =>
    request<any>(`/organizations/${orgId}/locations`, { params: { page, limit } }),

  get: (orgId: string, locId: string) =>
    request<any>(`/organizations/${orgId}/locations/${locId}`),

  create: (orgId: string, data: { name: string; address?: string; rubric?: string }) =>
    request<any>(`/organizations/${orgId}/locations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (orgId: string, locId: string, data: Partial<{ name: string; address?: string; rubric?: string; active?: boolean }>) =>
    request<any>(`/organizations/${orgId}/locations/${locId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Obligations
export const obligations = {
  list: (orgId: string, params?: { page?: number; limit?: number; status?: string; type?: string; locationId?: string }) =>
    request<any>(`/organizations/${orgId}/obligations`, { params }),

  get: (orgId: string, oblId: string) =>
    request<any>(`/organizations/${orgId}/obligations/${oblId}`),

  getDashboard: (orgId: string) =>
    request<any>(`/organizations/${orgId}/obligations/dashboard`),

  getCalendar: (orgId: string, startDate: string, endDate: string) =>
    request<any>(`/organizations/${orgId}/obligations/calendar`, {
      params: { startDate, endDate },
    }),

  create: (orgId: string, data: any) =>
    request<any>(`/organizations/${orgId}/obligations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (orgId: string, oblId: string, data: any) =>
    request<any>(`/organizations/${orgId}/obligations/${oblId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateStatus: (orgId: string, oblId: string, status: string) =>
    request<any>(`/organizations/${orgId}/obligations/${oblId}/status`, {
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
    request<any>(`/organizations/${orgId}/tasks`, { params }),

  get: (orgId: string, taskId: string) =>
    request<any>(`/organizations/${orgId}/tasks/${taskId}`),

  create: (orgId: string, data: any) =>
    request<any>(`/organizations/${orgId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (orgId: string, taskId: string, data: any) =>
    request<any>(`/organizations/${orgId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  toggleItem: (orgId: string, taskId: string, itemId: string) =>
    request<any>(`/organizations/${orgId}/tasks/${taskId}/items/${itemId}/toggle`, {
      method: 'POST',
    }),
};

// Documents
export const documents = {
  list: (orgId: string, params?: { page?: number; limit?: number; obligationId?: string; taskId?: string }) =>
    request<any>(`/organizations/${orgId}/documents`, { params }),

  get: (orgId: string, docId: string) =>
    request<any>(`/organizations/${orgId}/documents/${docId}`),

  getUploadUrl: (orgId: string, fileName: string, mimeType: string) =>
    request<{ uploadUrl: string; fileKey: string }>(`/organizations/${orgId}/documents/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ fileName, mimeType }),
    }),

  register: (orgId: string, data: { fileName: string; mimeType: string; sizeBytes: number; fileKey: string; obligationId?: string; taskId?: string }) =>
    request<any>(`/organizations/${orgId}/documents`, {
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
    request<any>(`/organizations/${orgId}/reviews/obligation/${obligationId}`, { params }),

  getPending: (orgId: string, params?: { page?: number; limit?: number }) =>
    request<any>(`/organizations/${orgId}/reviews/pending`, { params }),

  create: (orgId: string, data: { obligationId: string; status: string; comment?: string }) =>
    request<any>(`/organizations/${orgId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Audit
export const audit = {
  list: (orgId: string, params?: { page?: number; limit?: number; action?: string; entityType?: string; fromDate?: string; toDate?: string }) =>
    request<any>(`/organizations/${orgId}/audit`, { params }),
};

// Reports
export const reports = {
  getCompliance: (orgId: string, params?: { fromDate?: string; toDate?: string; locationId?: string }) =>
    request<any>(`/organizations/${orgId}/reports/compliance`, { params }),

  getObligations: (orgId: string, params?: { fromDate?: string; toDate?: string; locationId?: string }) =>
    request<any>(`/organizations/${orgId}/reports/obligations`, { params }),

  exportCsv: (orgId: string, params?: { fromDate?: string; toDate?: string; locationId?: string }) =>
    `${API_URL}/organizations/${orgId}/reports/export/csv?${new URLSearchParams(params as any).toString()}`,
};

export { ApiError };
