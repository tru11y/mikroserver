'use client';

import type { HotspotIpBinding, IpBindingType } from './router-detail.types';
import { normalizeIpBindingType } from './router-detail.utils';

export interface HotspotIpBindingFormValues {
  server: string;
  address: string;
  macAddress: string;
  type: IpBindingType;
  comment: string;
  toAddress: string;
  addressList: string;
  disabled: boolean;
}

export function createEmptyHotspotIpBindingForm(
  server = '',
): HotspotIpBindingFormValues {
  return {
    server,
    address: '',
    macAddress: '',
    type: 'regular',
    comment: '',
    toAddress: '',
    addressList: '',
    disabled: false,
  };
}

export function createHotspotIpBindingFormFromBinding(
  binding: HotspotIpBinding,
): HotspotIpBindingFormValues {
  return {
    server: binding.server ?? '',
    address: binding.address ?? '',
    macAddress: binding.macAddress ?? '',
    type: normalizeIpBindingType(binding.type),
    comment: binding.comment ?? '',
    toAddress: binding.toAddress ?? '',
    addressList: binding.addressList ?? '',
    disabled: Boolean(binding.disabled),
  };
}

export function hasHotspotIpBindingIdentity(
  form: HotspotIpBindingFormValues,
): boolean {
  return form.address.trim().length > 0 || form.macAddress.trim().length > 0;
}

export function buildCreateHotspotIpBindingPayload(
  form: HotspotIpBindingFormValues,
) {
  return {
    server: form.server.trim() || undefined,
    address: form.address.trim() || undefined,
    macAddress: form.macAddress.trim() || undefined,
    type: form.type,
    comment: form.comment.trim(),
    toAddress: form.toAddress.trim(),
    addressList: form.addressList.trim(),
    disabled: form.disabled,
  };
}

export function buildUpdateHotspotIpBindingPayload(
  form: HotspotIpBindingFormValues,
) {
  return {
    server: form.server.trim(),
    address: form.address.trim(),
    macAddress: form.macAddress.trim(),
    type: form.type,
    comment: form.comment.trim(),
    toAddress: form.toAddress.trim(),
    addressList: form.addressList.trim(),
    disabled: form.disabled,
  };
}
