import {
  buildProfileLabel,
  filterResellers,
  getRoleLabel,
  getUserInitials,
} from './resellers.utils';

describe('resellers.utils', () => {
  it('builds profile labels', () => {
    expect(buildProfileLabel('RESELLER_STANDARD', [])).toBe('Reseller Standard');
    expect(buildProfileLabel(null, ['users.view'])).toBe('Personnalise');
    expect(buildProfileLabel(null, [])).toBe('Par defaut');
  });

  it('filters resellers by status, role and search', () => {
    const rows = [
      {
        id: '1',
        email: 'alpha@test.com',
        firstName: 'Alpha',
        lastName: 'One',
        phone: null,
        role: 'RESELLER',
        status: 'ACTIVE',
        permissionProfile: 'RESELLER_STANDARD',
        permissionOverrides: [],
        permissions: [],
        lastLoginAt: null,
        createdAt: '',
      },
      {
        id: '2',
        email: 'beta@test.com',
        firstName: 'Beta',
        lastName: 'Two',
        phone: null,
        role: 'ADMIN',
        status: 'SUSPENDED',
        permissionProfile: null,
        permissionOverrides: ['users.manage'],
        permissions: [],
        lastLoginAt: null,
        createdAt: '',
      },
    ] as const;

    expect(filterResellers([...rows], 'ALL', 'ALL', 'alpha')).toHaveLength(1);
    expect(filterResellers([...rows], 'ADMIN', 'SUSPENDED', '')).toHaveLength(1);
    expect(filterResellers([...rows], 'RESELLER', 'SUSPENDED', '')).toHaveLength(0);
  });

  it('formats role labels and initials', () => {
    expect(getRoleLabel('SUPER_ADMIN')).toBe('Super Admin');
    expect(getUserInitials({ firstName: 'John', lastName: 'Doe' })).toBe('JD');
  });
});
