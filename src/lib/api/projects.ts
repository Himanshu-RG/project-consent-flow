/**
 * Projects API methods
 * Handles all project CRUD operations
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../api-client';
import type { ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse } from '../api-types';

/**
 * Create a new project
 */
export const createProject = async (projectData: ProjectCreate): Promise<ProjectResponse> => {
    return apiPost<ProjectResponse>('projects', projectData);
};

/**
 * Get list of projects with pagination and filtering
 */
export const getProjects = async (
    page: number = 1,
    limit: number = 10,
    status?: string
): Promise<ProjectListResponse> => {
    const params: Record<string, any> = { page, limit };
    if (status) {
        params.status = status;
    }

    return apiGet<ProjectListResponse>('projects', params);
};

/**
 * List projects (alias for getProjects with object params)
 */
export const listProjects = async (params: {
    page?: number;
    limit?: number;
    status?: string;
} = {}): Promise<ProjectListResponse> => {
    return getProjects(params.page, params.limit, params.status);
};

/**
 * Get a single project by ID
 */
export const getProject = async (projectId: string): Promise<ProjectResponse> => {
    return apiGet<ProjectResponse>(`projects/${projectId}`);
};

/**
 * Update a project
 */
export const updateProject = async (
    projectId: string,
    projectData: ProjectUpdate
): Promise<ProjectResponse> => {
    return apiPut<ProjectResponse>(`projects/${projectId}`, projectData);
};

/**
 * Delete a project
 */
export const deleteProject = async (projectId: string): Promise<void> => {
    return apiDelete<void>(`projects/${projectId}`);
};

/**
 * Trigger ML processing for a project
 */
export const processProject = async (projectId: string): Promise<any> => {
    return apiPost<any>(`projects/${projectId}/process`, {});
};
