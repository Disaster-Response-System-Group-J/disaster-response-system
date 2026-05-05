export interface ReportFormData {
  disasterType: string;
  district: string;
  description: string;
  contact: string;
  latitude: string;
  longitude: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateReportForm(form: ReportFormData): ValidationResult {
  const errors: string[] = [];

  if (!form.disasterType.trim()) errors.push('Disaster type is required');
  if (!form.district.trim()) errors.push('District is required');
  if (!form.description.trim()) errors.push('Description is required');

  return { isValid: errors.length === 0, errors };
}

export function isSubmitDisabled(form: ReportFormData, submitting: boolean): boolean {
  return submitting || !form.disasterType || !form.district || !form.description;
}
