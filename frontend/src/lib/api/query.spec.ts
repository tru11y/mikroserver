import { toQueryString, withQuery } from './query';

describe('api query helpers', () => {
  it('ignores empty values and trims string params', () => {
    const value = toQueryString({
      search: '  hotspot  ',
      empty: '   ',
      n: 5,
      enabled: true,
      skipNull: null,
      skipUndefined: undefined,
    });

    expect(value).toBe('search=hotspot&n=5&enabled=true');
  });

  it('builds a path without query when all values are omitted', () => {
    expect(withQuery('/routers', { status: undefined, search: '   ' })).toBe(
      '/routers',
    );
  });

  it('builds a path with query string when params are present', () => {
    expect(withQuery('/routers', { status: 'ONLINE', search: 'bz' })).toBe(
      '/routers?status=ONLINE&search=bz',
    );
  });
});
