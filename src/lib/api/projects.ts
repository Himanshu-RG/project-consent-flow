/**
 * Projects API methods
 * Handles all project CRUD operations
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../api-client';
import type { ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse } from '../api-types';

/**
 * Create a new project
 * Accepts either ProjectCreate object or FormData (for file uploads)
 */
export const createProject = async (projectData: ProjectCreate | FormData): Promise<ProjectResponse> => {
    if (projectData instanceof FormData) {
        // Handle FormData upload with files
        return apiPost<ProjectResponse>('projects', projectData, {
            headers: {
                // Let browser set Content-Type with boundary for multipart/form-data
            },
        });
    }
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
 * Trigger ML processing for a project.
 * Returns immediately with { task_id, status, message } — processing runs in the background.
 */
export const processProject = async (projectId: string): Promise<{ task_id: string; project_id: string; status: string; message: string }> => {
    return apiPost<any>(`projects/${projectId}/process`, {});
};

/**
 * Subscribe to real-time SSE progress for an ML processing task.
 * onEvent is called with each progress snapshot.
 * Returns the EventSource so the caller can close() it when done.
 */
export const subscribeToProcessProgress = (
    projectId: string,
    taskId: string,
    onEvent: (data: {
        status: string;
        progress: number;
        total: number;
        current_image: string | null;
        result: any;
        error: string | null;
    }) => void,
    onDone: () => void,
    onError: (err: string) => void,
): EventSource => {
    const url = `http://localhost:8000/api/projects/${projectId}/process/status/${taskId}`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            onEvent(data);
            if (data.status === 'done') {
                es.close();
                onDone();
            } else if (data.status === 'error') {
                es.close();
                onError(data.error || 'Processing failed');
            }
        } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
        es.close();
        onError('Connection to progress stream lost');
    };

    return es;
};

/**
 * Upload a consent PDF directly for a specific detected person.
 * Sets consent_status = 'granted' on success.
 */
export const uploadPersonConsent = async (
    projectId: string,
    personId: string,
    file: File
): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('form_name', file.name);
    return apiPost<any>(`projects/${projectId}/persons/${personId}/consent`, formData);
};

/**
 * Trigger consent PDF → person name matching for a project.
 * Re-runs matching logic comparing PDF filenames to person pids.
 */
export const triggerConsentMatch = async (projectId: string): Promise<{ matched: number; message: string }> => {
    return apiPost<any>(`projects/${projectId}/consent/match`, {});
};

/**
 * Get persons in a project
 */
export const getPersons = async (projectId: string): Promise<any[]> => {
    return apiGet<any[]>(`projects/${projectId}/persons`);
};
