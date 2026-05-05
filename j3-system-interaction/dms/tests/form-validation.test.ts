import { describe, it, expect } from 'vitest';
import { validateReportForm, isSubmitDisabled } from '@/lib/validation';

const validForm = {
  disasterType: 'FLOOD',
  district: 'Colombo',
  description: 'Severe flooding in the city area affecting hundreds of residents.',
  contact: '+94 71 234 5678',
  latitude: '6.9271',
  longitude: '79.8612',
};

describe('validateReportForm', () => {
  it('returns valid for a fully filled form', () => {
    const result = validateReportForm(validForm);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error when disasterType is empty', () => {
    const result = validateReportForm({ ...validForm, disasterType: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Disaster type is required');
  });

  it('returns error when district is empty', () => {
    const result = validateReportForm({ ...validForm, district: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('District is required');
  });

  it('returns error when description is empty', () => {
    const result = validateReportForm({ ...validForm, description: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Description is required');
  });

  it('rejects description that is only whitespace', () => {
    const result = validateReportForm({ ...validForm, description: '   ' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Description is required');
  });

  it('contact is optional — empty contact is still valid', () => {
    const result = validateReportForm({ ...validForm, contact: '' });
    expect(result.isValid).toBe(true);
  });

  it('latitude and longitude are optional — empty values are still valid', () => {
    const result = validateReportForm({ ...validForm, latitude: '', longitude: '' });
    expect(result.isValid).toBe(true);
  });

  it('returns multiple errors when all required fields are missing', () => {
    const result = validateReportForm({
      disasterType: '',
      district: '',
      description: '',
      contact: '',
      latitude: '',
      longitude: '',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.errors).toContain('Disaster type is required');
    expect(result.errors).toContain('District is required');
    expect(result.errors).toContain('Description is required');
  });

  it('does not include contact or coordinates in errors when missing', () => {
    const result = validateReportForm({
      ...validForm,
      contact: '',
      latitude: '',
      longitude: '',
    });
    expect(result.errors).not.toContain('Contact is required');
    expect(result.errors).not.toContain('Latitude is required');
  });
});

describe('isSubmitDisabled', () => {
  it('returns false (button enabled) when form is complete and not submitting', () => {
    expect(isSubmitDisabled(validForm, false)).toBe(false);
  });

  it('returns true (button disabled) while submitting', () => {
    expect(isSubmitDisabled(validForm, true)).toBe(true);
  });

  it('returns true when disasterType is missing', () => {
    expect(isSubmitDisabled({ ...validForm, disasterType: '' }, false)).toBe(true);
  });

  it('returns true when district is missing', () => {
    expect(isSubmitDisabled({ ...validForm, district: '' }, false)).toBe(true);
  });

  it('returns true when description is missing', () => {
    expect(isSubmitDisabled({ ...validForm, description: '' }, false)).toBe(true);
  });

  it('returns true when all required fields are missing and not submitting', () => {
    expect(isSubmitDisabled(
      { disasterType: '', district: '', description: '', contact: '', latitude: '', longitude: '' },
      false,
    )).toBe(true);
  });
});
