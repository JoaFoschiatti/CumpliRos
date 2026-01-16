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
  setAccessToken: (accessToken: string) => void;
  setOrganizations: (organizations: OrganizationMembership[]) => void;
  setCurrentOrganization: (organizationId: string | null) => void;
  logout: () => void;
  getCurrentOrganization: () => OrganizationMembership | undefined;
  getAccessToken: () => string | null;
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
      },

      setAccessToken: (accessToken) => {
        set({ accessToken });
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
      },

      getCurrentOrganization: () => {
        const state = get();
        return state.organizations.find((o) => o.id === state.currentOrganizationId);
      },

      getAccessToken: () => {
        return get().accessToken;
      },
    }),
    {
      name: 'cumpliros-auth',
      // SECURITY: Only persist non-sensitive data and refreshToken
      // accessToken is kept in memory only to reduce XSS risk
      partialize: (state) => ({
        user: state.user,
        // accessToken is NOT persisted - kept in memory only
        refreshToken: state.refreshToken,
        organizations: state.organizations,
        currentOrganizationId: state.currentOrganizationId,
      }),
    }
  )
);
