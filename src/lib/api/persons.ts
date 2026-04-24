/**
 * Persons API methods
 * Handles person/participant management within projects
 */

import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '../api-client';
import type { PersonCreate, PersonUpdate, PersonResponse, KnownPersonResponse } from '../api-types';

/**
 * Get all known persons (lab dataset members)
 */
export const getKnownPersons = async (): Promise<KnownPersonResponse[]> => {
    return apiGet<KnownPersonResponse[]>('known-persons');
};

/**
 * Create a new person in a project
 */
export const createPerson = async (
    projectId: string,
    personData: PersonCreate
): Promise<PersonResponse> => {
    return apiPost<PersonResponse>(`projects/${projectId}/persons`, personData);
};

/**
 * Get all persons in a project
 */
export const getPersons = async (projectId: string): Promise<PersonResponse[]> => {
    return apiGet<PersonResponse[]>(`projects/${projectId}/persons`);
};

/**
 * Update a person
 */
export const updatePerson = async (
    personId: string,
    personData: PersonUpdate
): Promise<PersonResponse> => {
    return apiPut<PersonResponse>(`persons/${personId}`, personData);
};

/**
 * Delete a person
 */
export const deletePerson = async (personId: string): Promise<void> => {
    return apiDelete<void>(`persons/${personId}`);
};

/**
 * Promote an unknown person to the global dataset
 */
export const promotePerson = async (
    projectId: string,
    personId: string,
    promoteData: { name: string; pid: string }
): Promise<PersonResponse> => {
    return apiPost<PersonResponse>(`projects/${projectId}/persons/${personId}/promote`, promoteData);
};

/**
 * Upload a known person to the global dataset
 * Requires multipart/form-data for the image file
 */
export const uploadKnownPerson = async (
    name: string,
    pid: string,
    file: File
): Promise<KnownPersonResponse> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('pid', pid);
    formData.append('file', file);
    return apiUpload<KnownPersonResponse>('known-persons/upload', formData);
};

/**
 * Delete a known person from the dataset by PID.
 * Also removes image from disk and evicts from ML cache.
 */
export const deleteKnownPerson = async (pid: string): Promise<void> => {
    return apiDelete<void>(`known-persons/${encodeURIComponent(pid)}`);
};
