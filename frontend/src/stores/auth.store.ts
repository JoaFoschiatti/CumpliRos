import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, OrganizationMembership } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  organizations: OrganizationMembership[];
  currentOrganizationId: string | null;

  setAuth: (user: User, accessToken: string) => void;
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
      organizations: [],
      currentOrganizationId: null,

      setAuth: (user, accessToken) => {
        set({ user, accessToken });
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
      // SECURITY: Only persist non-sensitive data.
      // Tokens are kept in memory (access token) or httpOnly cookie (refresh token).
      partialize: (state) => ({
        user: state.user,
        organizations: state.organizations,
        currentOrganizationId: state.currentOrganizationId,
      }),
    }
  )
);
