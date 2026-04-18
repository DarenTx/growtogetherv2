// ─── Shared constants ─────────────────────────────────────────────────────────

export const MOCK_SESSION = {
  user: { id: 'user-uuid-1', email: 'john@example.com' },
  access_token: 'mock-token',
};

export const MOCK_PROFILE_COMPLETE = {
  id: 'user-uuid-1',
  first_name: 'John',
  last_name: 'Doe',
  work_email: 'john@example.com',
  personal_email: 'john.personal@example.com',
  is_admin: false,
  work_email_verified: true,
  personal_email_verified: false,
  registration_complete: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const MOCK_PROFILE_INCOMPLETE = {
  ...MOCK_PROFILE_COMPLETE,
  first_name: null,
  last_name: null,
  registration_complete: false,
};

export const MOCK_PROFILE_ADMIN = {
  ...MOCK_PROFILE_COMPLETE,
  is_admin: true,
};

// ─── Per-service mock factories ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockAuthService(): Record<string, any> {
  return {
    getSession: vi.fn().mockResolvedValue(MOCK_SESSION),
    signInWithGooglePopup: vi.fn().mockResolvedValue(undefined),
    signInWithGoogleIdToken: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    authCallbackUrl: 'http://localhost/auth/callback',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockProfileService(): Record<string, any> {
  return {
    getProfile: vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE),
    completeRegistration: vi.fn().mockResolvedValue(true),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    isAdmin: vi.fn().mockResolvedValue(false),
    getRegisteredProfiles: vi.fn().mockResolvedValue([]),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockGrowthDataService(): Record<string, any> {
  return {
    getOwnGrowthData: vi.fn().mockResolvedValue([]),
    getOwnGrowthDataForMonth: vi.fn().mockResolvedValue(null),
    getOwnBankNames: vi.fn().mockResolvedValue([]),
    deleteOwnGrowthDataForMonth: vi.fn().mockResolvedValue(undefined),
    saveOwnGrowthDataForMonth: vi.fn().mockResolvedValue(undefined),
    getAllGrowthData: vi.fn().mockResolvedValue([]),
    getGrowthDataForYear: vi.fn().mockResolvedValue([]),
    saveGrowthData: vi.fn().mockResolvedValue(undefined),
    getGrowthDataByEmailKey: vi.fn().mockResolvedValue([]),
    getGrowthDataForUserYear: vi.fn().mockResolvedValue([]),
    getGrowthDataForYearMonth: vi.fn().mockResolvedValue([]),
    getAvailableYears: vi.fn().mockResolvedValue([]),
    getAvailableYearsForUser: vi.fn().mockResolvedValue([]),
    getPersonBankList: vi.fn().mockResolvedValue([]),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockMarketDataService(): Record<string, any> {
  return {
    getMarketIndexes: vi.fn().mockResolvedValue([]),
    saveMarketIndex: vi.fn().mockResolvedValue(undefined),
    getMarketIndexesForMonth: vi.fn().mockResolvedValue([]),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockAuditService(): Record<string, any> {
  return {
    getAuditLogPage: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockAdminService(): Record<string, any> {
  return {
    getAllProfiles: vi.fn().mockResolvedValue([]),
    adminCreateProfile: vi.fn().mockResolvedValue(undefined),
  };
}
