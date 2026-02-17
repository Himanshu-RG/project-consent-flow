import React, { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "admin" | "user";

interface AuthUser {
  username: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string, role: UserRole) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const CREDENTIALS: Record<string, { password: string; role: UserRole }> = {
  admin: { password: "admin", role: "admin" },
  user: { password: "user", role: "user" },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = (username: string, password: string, role: UserRole): boolean => {
    const cred = CREDENTIALS[username];
    if (cred && cred.password === password && cred.role === role) {
      setUser({ username, role });
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
