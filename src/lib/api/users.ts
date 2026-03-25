
import { apiUpload } from '../api-client';
import { UserResponse } from '../api-types';

export const uploadIdentity = async (file: File): Promise<UserResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    return apiUpload<UserResponse>('users/me/identity', formData);
};

export const uploadUserConsent = async (file: File): Promise<UserResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    return apiUpload<UserResponse>('users/me/consent', formData);
};
