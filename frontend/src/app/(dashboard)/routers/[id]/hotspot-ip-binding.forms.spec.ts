import {
  buildCreateHotspotIpBindingPayload,
  buildUpdateHotspotIpBindingPayload,
  createEmptyHotspotIpBindingForm,
  createHotspotIpBindingFormFromBinding,
  hasHotspotIpBindingIdentity,
} from './hotspot-ip-binding.forms';

describe('hotspot-ip-binding.forms', () => {
  it('creates an empty form with an optional default server', () => {
    expect(createEmptyHotspotIpBindingForm('hotspot1')).toEqual({
      server: 'hotspot1',
      address: '',
      macAddress: '',
      type: 'regular',
      comment: '',
      toAddress: '',
      addressList: '',
      disabled: false,
    });
  });

  it('maps a binding into editable form values', () => {
    expect(
      createHotspotIpBindingFormFromBinding({
        id: '*1',
        address: '10.0.0.8',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        type: 'bypassed',
        disabled: true,
        server: 'hotspot1',
        comment: 'camera',
        toAddress: '10.0.0.10',
        addressList: 'whitelist',
      } as never),
    ).toMatchObject({
      server: 'hotspot1',
      address: '10.0.0.8',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      type: 'bypassed',
      disabled: true,
    });
  });

  it('detects whether the form has a primary IP or MAC identity', () => {
    expect(
      hasHotspotIpBindingIdentity(createEmptyHotspotIpBindingForm()),
    ).toBe(false);
    expect(
      hasHotspotIpBindingIdentity({
        ...createEmptyHotspotIpBindingForm(),
        macAddress: 'AA:BB:CC:DD:EE:FF',
      }),
    ).toBe(true);
  });

  it('builds trimmed create and update payloads', () => {
    const form = {
      server: ' hotspot1 ',
      address: ' 10.0.0.8 ',
      macAddress: ' AA:BB:CC:DD:EE:FF ',
      type: 'blocked' as const,
      comment: ' camera ',
      toAddress: ' 10.0.0.10 ',
      addressList: ' whitelist ',
      disabled: true,
    };

    expect(buildCreateHotspotIpBindingPayload(form)).toEqual({
      server: 'hotspot1',
      address: '10.0.0.8',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      type: 'blocked',
      comment: 'camera',
      toAddress: '10.0.0.10',
      addressList: 'whitelist',
      disabled: true,
    });

    expect(buildUpdateHotspotIpBindingPayload(form)).toEqual({
      server: 'hotspot1',
      address: '10.0.0.8',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      type: 'blocked',
      comment: 'camera',
      toAddress: '10.0.0.10',
      addressList: 'whitelist',
      disabled: true,
    });
  });
});
