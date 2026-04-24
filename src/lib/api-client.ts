/**
 * Simplified API client (no JWT tokens)
 */

import type { ErrorResponse } from './api-types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_PREFIX = '/api';

/**
 * Build full URL for API endpoint
 */
const buildUrl = (endpoint: string): string => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${API_BASE_URL}${API_PREFIX}/${cleanEndpoint}`;
};

/**
 * Build request headers
 */
const buildHeaders = (contentType: string = 'application/json'): HeadersInit => {
    const headers: HeadersInit = {};

    if (contentType) {
        headers['Content-Type'] = contentType;
    }

    // Use simple user ID header instead of JWT
    const userId = localStorage.getItem('consentmap_user_id');
    if (userId) {
        headers['X-User-ID'] = userId;
    }

    return headers;
};

/**
 * Custom API Error class
 */
export class ApiError extends Error {
    constructor(
        public status: number,
        public statusText: string,
        public data?: ErrorResponse
    ) {
        super(data?.message || statusText);
        this.name = 'ApiError';
    }
}

/**
 * Handle API response
 */
const handleResponse = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        let errorData: ErrorResponse | undefined;
        try {
            errorData = await response.json();
        } catch {
            // Response might not be JSON
        }
        throw new ApiError(response.status, response.statusText, errorData);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
};

/**
 * Generic GET request
 */
export const apiGet = async <T>(
    endpoint: string,
    params?: Record<string, any>
): Promise<T> => {
    let url = buildUrl(endpoint);

    if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        });
        url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: buildHeaders(),
    });

    return handleResponse<T>(response);
};

/**
 * Generic POST request
 */
export const apiPost = async <T>(
    endpoint: string,
    data?: any,
    options?: { headers?: HeadersInit }
): Promise<T> => {
    const isFormData = data instanceof FormData;

    // Build headers
    let headers: HeadersInit;
    if (isFormData) {
        // For FormData, don't set Content-Type (browser will set it with boundary)
        const userId = localStorage.getItem('consentmap_user_id');
        headers = userId ? { 'X-User-ID': userId } : {};
    } else {
        headers = buildHeaders('application/json');
    }

    // Merge with custom headers if provided
    if (options?.headers) {
        headers = { ...headers, ...options.headers };
    }

    const response = await fetch(buildUrl(endpoint), {
        method: 'POST',
        headers,
        body: isFormData ? data : JSON.stringify(data),
    });

    return handleResponse<T>(response);
};

/**
 * Generic PUT request
 */
export const apiPut = async <T>(
    endpoint: string,
    data?: any
): Promise<T> => {
    const response = await fetch(buildUrl(endpoint), {
        method: 'PUT',
        headers: buildHeaders('application/json'),
        body: JSON.stringify(data),
    });

    return handleResponse<T>(response);
};

/**
 * Generic DELETE request
 */
export const apiDelete = async <T>(
    endpoint: string
): Promise<T> => {
    const response = await fetch(buildUrl(endpoint), {
        method: 'DELETE',
        headers: buildHeaders(),
    });

    return handleResponse<T>(response);
};

/**
 * File upload request
 */
export const apiUpload = async <T>(
    endpoint: string,
    formData: FormData
): Promise<T> => {
    // Build headers but exclude Content-Type for FormData
    const userId = localStorage.getItem('consentmap_user_id');
    const headers: HeadersInit = {};

    if (userId) {
        headers['X-User-ID'] = userId;
    }

    const response = await fetch(buildUrl(endpoint), {
        method: 'POST',
        headers: headers,
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary
    });

    return handleResponse<T>(response);
};
