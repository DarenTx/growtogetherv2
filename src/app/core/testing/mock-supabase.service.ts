export const MOCK_SESSION = {
  user: { id: 'user-uuid-1', email: 'john@example.com', phone: '+12125551234' },
  access_token: 'mock-token',
};

export const MOCK_PROFILE_COMPLETE = {
  id: 'user-uuid-1',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  phone: '+12125551234',
  is_admin: false,
  email_verified: true,
  phone_verified: false,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockSupabaseService(): Record<string, any> {
  return {
    getSession: vi.fn().mockResolvedValue(MOCK_SESSION),
    getProfile: vi.fn().mockResolvedValue(MOCK_PROFILE_COMPLETE),
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    signInWithPhone: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    completeRegistration: vi.fn().mockResolvedValue(true),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    isAdmin: vi.fn().mockResolvedValue(false),
    getOwnGrowthData: vi.fn().mockResolvedValue([]),
    getAllGrowthData: vi.fn().mockResolvedValue([]),
    getGrowthDataForYear: vi.fn().mockResolvedValue([]),
    saveGrowthData: vi.fn().mockResolvedValue(undefined),
    getMarketIndexes: vi.fn().mockResolvedValue([]),
    saveMarketIndex: vi.fn().mockResolvedValue(undefined),
    getAllProfiles: vi.fn().mockResolvedValue([]),
    adminCreateProfile: vi.fn().mockResolvedValue(undefined),
    getGrowthDataByEmailKey: vi.fn().mockResolvedValue([]),
    authCallbackUrl: 'http://localhost/auth/callback',
  };
}
