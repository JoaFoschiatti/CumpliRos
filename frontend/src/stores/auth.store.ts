import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, OrganizationMembership } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  organizations: OrganizationMembership[];
  currentOrganizationId: string | null;

  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setOrganizations: (organizations: OrganizationMembership[]) => void;
  setCurrentOrganization: (organizationId: string | null) => void;
  logout: () => void;
  getCurrentOrganization: () => OrganizationMembership | undefined;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      organizations: [],
      currentOrganizationId: null,

      setAuth: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken });
        // Also store in localStorage for API client
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
        }
      },

      setOrganizations: (organizations) => {
        set({ organizations });
        // Auto-select first org if none selected
        const state = get();
        if (!state.currentOrganizationId && organizations.length > 0) {
          set({ currentOrganizationId: organizations[0].id });
        }
      },

      setCurrentOrganization: (organizationId) => {
        set({ currentOrganizationId: organizationId });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          organizations: [],
          currentOrganizationId: null,
        });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      },

      getCurrentOrganization: () => {
        const state = get();
        return state.organizations.find((o) => o.id === state.currentOrganizationId);
      },
    }),
    {
      name: 'cumpliros-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        organizations: state.organizations,
        currentOrganizationId: state.currentOrganizationId,
      }),
    }
  )
);
