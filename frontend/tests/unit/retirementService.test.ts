const createMockUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'USER-001',
  username: 'testuser',
  role: 'USER',
  ...overrides,
});

describe('retirementService', () => {
  // ===========================================================
  // arrow_fn createMockUser
  // ===========================================================
  it('createMockUser should create a user with default values', () => {
    const user = createMockUser();
    expect(user.id).toBe('USER-001');
    expect(user.username).toBe('testuser');
    expect(user.role).toBe('USER');
  });

  it('createMockUser should accept overrides', () => {
    const user = createMockUser({ id: 'USER-002', role: 'ADMIN' });
    expect(user.id).toBe('USER-002');
    expect(user.role).toBe('ADMIN');
    expect(user.username).toBe('testuser');
  });
});
