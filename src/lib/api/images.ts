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

// ─── Manual Redaction Box API ────────────────────────────────────────────────

export interface ManualBoxPayload {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  consented: boolean;
  label: string;
  pdfName?: string;
}

/**
 * Save (overwrite) the list of manual redaction boxes for an image.
 * Green boxes that carry a new PDF file are uploaded via multipart/form-data.
 */
export const saveManualRedactBoxes = async (
    projectId: string,
    imageId: string,
    boxes: Array<{
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        consented: boolean;
        label: string;
        pdf?: File | null;
        pdfName?: string;
    }>
): Promise<{ saved: number }> => {
    const formData = new FormData();

    // Serialize box metadata (without File objects) as JSON
    const boxMeta = boxes.map(({ pdf: _pdf, ...rest }) => rest);
    formData.append("boxes", JSON.stringify(boxMeta));

    // Attach any PDF files keyed by box index
    boxes.forEach((b, i) => {
        if (b.pdf instanceof File) {
            formData.append(`pdf_${i}`, b.pdf, b.pdf.name);
        }
    });

    const userId = localStorage.getItem("consentmap_user_id");
    const headers: HeadersInit = userId ? { "X-User-ID": userId } : {};

    const response = await fetch(
        `http://localhost:8000/api/projects/${projectId}/images/${imageId}/manual-redact-upload`,
        { method: "POST", headers, body: formData }
    );
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to save manual redaction boxes");
    }
    return response.json();
};

/**
 * Fetch the stored manual redaction boxes for an image.
 */
export const getManualRedactBoxes = async (
    projectId: string,
    imageId: string
): Promise<ManualBoxPayload[]> => {
    const userId = localStorage.getItem("consentmap_user_id");
    const headers: HeadersInit = userId ? { "X-User-ID": userId } : {};

    const response = await fetch(
        `http://localhost:8000/api/projects/${projectId}/images/${imageId}/manual-redact`,
        { method: "GET", headers }
    );
    if (!response.ok) return [];
    return response.json();
};
