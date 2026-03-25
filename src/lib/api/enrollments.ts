/**
 * API client functions for project enrollment management.
 */

import { apiPost, apiDelete, apiGet } from '../api-client';
import { UserResponse, MessageResponse } from '../api-types';

/**
 * Enroll a user in a project
 */
export const enrollUser = async (projectId: string, userId: string): Promise<MessageResponse> => {
    return apiPost(`/enrollments/projects/${projectId}/enroll/${userId}`, {});
};

/**
 * Remove a user from a project
 */
export const unenrollUser = async (projectId: string, userId: string): Promise<MessageResponse> => {
    return apiDelete(`/enrollments/projects/${projectId}/enroll/${userId}`);
};

/**
 * Get all users enrolled in a project
 */
export const getEnrolledUsers = async (projectId: string): Promise<UserResponse[]> => {
    return apiGet(`/enrollments/projects/${projectId}/enrolled-users`);
};

/**
 * Get all users (for enrollment selection)
 */
export const getAllUsers = async (): Promise<UserResponse[]> => {
    return apiGet('/users');
};

/**
 * Get enrollment and consent status for all users in a project
 */
export const getEnrollmentStatus = async (projectId: string): Promise<any[]> => {
    return apiGet(`/enrollments/projects/${projectId}/enrollment-status`);
};

/**
 * Upload consent PDF directly for a specific person
 */
export const uploadPersonConsent = async (
    projectId: string,
    personId: string,
    file: File
): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('form_name', 'Direct Consent Upload');

    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/projects/${projectId}/persons/${personId}/consent`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload consent');
    }

    return response.json();
};
