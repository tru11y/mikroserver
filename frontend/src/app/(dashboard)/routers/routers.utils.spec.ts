import { EMPTY_FORM, getStatusLabel, parseTags, toFormState } from './routers.utils';

describe('routers.utils', () => {
  it('parses unique tags and caps them', () => {
    expect(parseTags('core, fibre, core, edge')).toEqual(['core', 'fibre', 'edge']);
  });

  it('maps router payload to form state', () => {
    expect(
      toFormState({
        id: '1',
        name: 'AKD-01',
        description: null,
        location: 'Plateau',
        site: 'Abidjan',
        tags: ['core', 'fibre'],
        wireguardIp: '10.0.0.1',
        apiPort: 8728,
        apiUsername: 'api',
        hotspotProfile: 'default',
        hotspotServer: 'hotspot1',
        status: 'ONLINE',
        lastSeenAt: null,
      }),
    ).toMatchObject({
      name: 'AKD-01',
      location: 'Plateau',
      site: 'Abidjan',
      tags: 'core, fibre',
      wireguardIp: '10.0.0.1',
      apiPort: '8728',
    });
  });

  it('returns empty form and labels', () => {
    expect(toFormState(null)).toEqual(EMPTY_FORM);
    expect(getStatusLabel('ONLINE')).toBe('En ligne');
    expect(getStatusLabel('OFFLINE')).toBe('Hors ligne');
  });
});
