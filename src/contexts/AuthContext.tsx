/**
 * Simplified Authentication Context (no JWT tokens)
 * Stores user data in localStorage for persistence
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '@/lib/api/auth';
import type { UserResponse, UserCreate, UserLogin } from '@/lib/api-types';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: UserLogin) => Promise<void>;
  register: (userData: UserCreate) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const USER_STORAGE_KEY = 'consentmap_user';
const USER_ID_STORAGE_KEY = 'consentmap_user_id';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Failed to load user from storage:', error);
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem(USER_ID_STORAGE_KEY);
      }
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const login = async (credentials: UserLogin) => {
    try {
      const userData = await authApi.login(credentials);
      
      setUser(userData);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      localStorage.setItem(USER_ID_STORAGE_KEY, userData.id);
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${userData.full_name || userData.email}!`,
      });
      
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
      throw error;
    }
  };

  const register = async (userData: UserCreate) => {
    try {
      const newUser = await authApi.register(userData);
      
      setUser(newUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
      localStorage.setItem(USER_ID_STORAGE_KEY, newUser.id);
      
      toast({
        title: "Registration Successful",
        description: `Welcome, ${newUser.full_name || newUser.email}!`,
      });
      
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(USER_ID_STORAGE_KEY);
      
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully",
      });
      navigate('/');
    }
  };
  
  const refreshProfile = async () => {
      try {
          const updatedUser = await authApi.getMe();
          setUser(updatedUser);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
      } catch (error) {
          console.error("Failed to refresh profile", error);
      }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
