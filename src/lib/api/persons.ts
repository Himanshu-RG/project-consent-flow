/**
 * Persons API methods
 * Handles person/participant management within projects
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../api-client';
import type { PersonCreate, PersonUpdate, PersonResponse } from '../api-types';

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
