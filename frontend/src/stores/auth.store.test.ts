import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth.store';
import { act } from '@testing-library/react';

// Reset store before each test
beforeEach(() => {
  act(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      organizations: [],
      currentOrganizationId: null,
    });
  });
});

describe('useAuthStore', () => {
  describe('initial state', () => {
    it('should have null user initially', () => {
      const { user } = useAuthStore.getState();
      expect(user).toBeNull();
    });

    it('should have null tokens initially', () => {
      const { accessToken } = useAuthStore.getState();
      expect(accessToken).toBeNull();
    });

    it('should have empty organizations initially', () => {
      const { organizations } = useAuthStore.getState();
      expect(organizations).toEqual([]);
    });
  });

  describe('setAuth', () => {
    it('should set user and access token', () => {
      const user = { id: 'user-1', email: 'test@test.com', fullName: 'Test User' };
      const accessToken = 'access-token';

      act(() => {
        useAuthStore.getState().setAuth(user, accessToken);
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.accessToken).toBe(accessToken);
    });
  });

  describe('setOrganizations', () => {
    it('should set organizations', () => {
      const organizations = [
        { id: 'org-1', name: 'Org 1', cuit: '20-12345678-9', role: 'OWNER' as const },
        { id: 'org-2', name: 'Org 2', cuit: '20-87654321-9', role: 'ADMIN' as const },
      ];

      act(() => {
        useAuthStore.getState().setOrganizations(organizations);
      });

      const state = useAuthStore.getState();
      expect(state.organizations).toEqual(organizations);
    });

    it('should auto-select first organization if none selected', () => {
      const organizations = [
        { id: 'org-1', name: 'Org 1', cuit: '20-12345678-9', role: 'OWNER' as const },
      ];

      act(() => {
        useAuthStore.getState().setOrganizations(organizations);
      });

      const state = useAuthStore.getState();
      expect(state.currentOrganizationId).toBe('org-1');
    });

    it('should not change selection if organization already selected', () => {
      act(() => {
        useAuthStore.setState({ currentOrganizationId: 'org-2' });
      });

      const organizations = [
        { id: 'org-1', name: 'Org 1', cuit: '20-12345678-9', role: 'OWNER' as const },
      ];

      act(() => {
        useAuthStore.getState().setOrganizations(organizations);
      });

      const state = useAuthStore.getState();
      expect(state.currentOrganizationId).toBe('org-2');
    });
  });

  describe('setCurrentOrganization', () => {
    it('should set current organization id', () => {
      act(() => {
        useAuthStore.getState().setCurrentOrganization('org-123');
      });

      const state = useAuthStore.getState();
      expect(state.currentOrganizationId).toBe('org-123');
    });

    it('should allow setting null', () => {
      act(() => {
        useAuthStore.setState({ currentOrganizationId: 'org-123' });
        useAuthStore.getState().setCurrentOrganization(null);
      });

      const state = useAuthStore.getState();
      expect(state.currentOrganizationId).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear all auth state', () => {
      // Set initial auth state
      act(() => {
        useAuthStore.setState({
          user: { id: 'user-1', email: 'test@test.com', fullName: 'Test' },
          accessToken: 'access-token',
          organizations: [{ id: 'org-1', name: 'Org', cuit: '20-12345678-9', role: 'OWNER' as const }],
          currentOrganizationId: 'org-1',
        });
      });

      // Logout
      act(() => {
        useAuthStore.getState().logout();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.organizations).toEqual([]);
      expect(state.currentOrganizationId).toBeNull();
    });
  });

  describe('getCurrentOrganization', () => {
    it('should return current organization', () => {
      const org = { id: 'org-1', name: 'Org 1', cuit: '20-12345678-9', role: 'OWNER' as const };

      act(() => {
        useAuthStore.setState({
          organizations: [org],
          currentOrganizationId: 'org-1',
        });
      });

      const currentOrg = useAuthStore.getState().getCurrentOrganization();
      expect(currentOrg).toEqual(org);
    });

    it('should return undefined if no organization selected', () => {
      act(() => {
        useAuthStore.setState({
          organizations: [{ id: 'org-1', name: 'Org', cuit: '20-12345678-9', role: 'OWNER' as const }],
          currentOrganizationId: null,
        });
      });

      const currentOrg = useAuthStore.getState().getCurrentOrganization();
      expect(currentOrg).toBeUndefined();
    });

    it('should return undefined if selected org not in list', () => {
      act(() => {
        useAuthStore.setState({
          organizations: [{ id: 'org-1', name: 'Org', cuit: '20-12345678-9', role: 'OWNER' as const }],
          currentOrganizationId: 'org-999',
        });
      });

      const currentOrg = useAuthStore.getState().getCurrentOrganization();
      expect(currentOrg).toBeUndefined();
    });
  });
});
