/**
 * Simplified authentication API (no JWT tokens)
 */

import { apiPost, apiGet } from '../api-client';
import type { UserCreate, UserLogin, UserResponse, MessageResponse } from '../api-types';

/**
 * Register a new user
 */
export const register = async (userData: UserCreate): Promise<UserResponse> => {
    return apiPost<UserResponse>('auth/register', userData);
};

/**
 * Login user with email and password
 */
export const login = async (credentials: UserLogin): Promise<UserResponse> => {
    return apiPost<UserResponse>('auth/login', credentials);
};

/**
 * Logout current user
 */
export const logout = async (): Promise<MessageResponse> => {
    return apiPost<MessageResponse>('auth/logout', {});
};

/**
 * Get current user profile
 */
export const getMe = async (): Promise<UserResponse> => {
    return apiGet<UserResponse>('users/me');
};
