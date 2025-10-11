import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'annotator' | 'viewer';
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      verifyToken(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Verify token and get user info
  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${tokenToVerify}`,
        },
      });

      if (response.data.success) {
        setUser(response.data.data);
        setToken(tokenToVerify);
        
        // Configure axios default header
        axios.defaults.headers.common['Authorization'] = `Bearer ${tokenToVerify}`;
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('auth_token');
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (username: string, password: string, rememberMe: boolean = false) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        username,
        password,
        rememberMe,
      });

      if (response.data.success) {
        const { token: newToken, user: userData } = response.data.data;
        
        setUser(userData);
        setToken(newToken);

        // Save token to localStorage
        localStorage.setItem('auth_token', newToken);

        // Save credentials if remember me (dev mode only!)
        if (rememberMe) {
          localStorage.setItem('remember_username', username);
        } else {
          localStorage.removeItem('remember_username');
        }

        // Configure axios default header
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      if (token) {
        await axios.post(`${API_URL}/auth/logout`, {}, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state and localStorage
      setUser(null);
      setToken(null);
      localStorage.removeItem('auth_token');
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
