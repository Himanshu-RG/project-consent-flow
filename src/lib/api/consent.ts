/**
 * Consent Forms API methods
 * Handles consent form PDF upload and management
 */

import { apiGet, apiPut, apiDelete, apiUpload } from '../api-client';
import type { ConsentFormResponse, ConsentFormUpdate } from '../api-types';

/**
 * Upload a consent form PDF
 */
export const uploadConsentForm = async (
    projectId: string,
    file: File,
    data: {
        person_id?: string;
        form_name: string;
        signed_date?: string;
        expiry_date?: string;
    }
): Promise<ConsentFormResponse> => {
    const formData = new FormData();

    // Add file (backend expects 'files' parameter)
    formData.append('files', file);

    // Add form data
    if (data.person_id) {
        formData.append('person_id', data.person_id);
    }
    formData.append('form_name', data.form_name);

    if (data.signed_date) {
        formData.append('signed_date', data.signed_date);
    }
    if (data.expiry_date) {
        formData.append('expiry_date', data.expiry_date);
    }

    return apiUpload<ConsentFormResponse>(`projects/${projectId}/consent`, formData);
};

/**
 * Get all consent forms in a project
 */
export const getConsentForms = async (projectId: string): Promise<ConsentFormResponse[]> => {
    return apiGet<ConsentFormResponse[]>(`projects/${projectId}/consent`);
};

/**
 * List consent forms (alias for getConsentForms)
 */
export const listConsentForms = getConsentForms;

/**
 * Update a consent form
 */
export const updateConsentForm = async (
    consentId: string,
    data: ConsentFormUpdate
): Promise<ConsentFormResponse> => {
    return apiPut<ConsentFormResponse>(`consent/${consentId}`, data);
};

/**
 * Delete a consent form
 */
export const deleteConsentForm = async (consentId: string): Promise<void> => {
    return apiDelete<void>(`consent/${consentId}`);
};
