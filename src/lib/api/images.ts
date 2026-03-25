/**
 * Images API methods
 * Handles image upload and management
 */

import { apiGet, apiDelete, apiUpload } from '../api-client';
import type { ImageResponse } from '../api-types';

/**
 * Upload images to a project
 */
export const uploadImages = async (
    projectId: string,
    files: File[],
    metadata?: {
        factor?: string;
        batch_number?: string;
        camera_type?: 'dslr' | 'mobile' | 'other';
    }
): Promise<ImageResponse[]> => {
    const formData = new FormData();

    // Add all files
    files.forEach((file) => {
        formData.append('files', file);
    });

    // Add metadata if provided
    if (metadata?.factor) {
        formData.append('factor', metadata.factor);
    }
    if (metadata?.batch_number) {
        formData.append('batch_number', metadata.batch_number);
    }
    if (metadata?.camera_type) {
        formData.append('camera_type', metadata.camera_type);
    }

    return apiUpload<ImageResponse[]>(`projects/${projectId}/images`, formData);
};

/**
 * Get all images in a project
 */
export const getImages = async (
    projectId: string,
    batchNumber?: string
): Promise<ImageResponse[]> => {
    const params: Record<string, any> = {};
    if (batchNumber) {
        params.batch_number = batchNumber;
    }

    return apiGet<ImageResponse[]>(`projects/${projectId}/images`, params);
};

/**
 * List images (alias for getImages)
 */
export const listImages = getImages;

/**
 * Get a single image by ID
 */
export const getImage = async (imageId: string): Promise<ImageResponse> => {
    return apiGet<ImageResponse>(`images/${imageId}`);
};

/**
 * Delete an image
 */
export const deleteImage = async (imageId: string): Promise<void> => {
    return apiDelete<void>(`images/${imageId}`);
};
