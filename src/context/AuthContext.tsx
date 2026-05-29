'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  appleLogin: (identityToken: string, name?: string, email?: string) => Promise<void>;
  appleSignup: (identityToken: string, name: string, email: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse user:', error);
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.error || 'Invalid email or password. Please check your credentials and try again.');
      }

      // Store session
      const userData = {
        id: json.user.id,
        email: json.user.email,
        name: json.user.name,
        role: json.user.role || 'standard',
      };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      // Validate inputs
      if (!email || !password || !name) {
        throw new Error('All fields are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const res = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.error || 'Registration failed');
      }

      // Auto-login after signup
      const userData = {
        id: json.user.id,
        email: json.user.email,
        name: json.user.name,
        role: json.user.role || 'standard',
      };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const appleLogin = async (identityToken: string, name?: string, email?: string) => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Get stored users
      const usersJSON = localStorage.getItem('users');
      const users = usersJSON ? JSON.parse(usersJSON) : [];

      // Find user by email or create one if it doesn't exist
      let foundUser = email ? users.find((u: any) => u.email === email) : null;

      if (!foundUser && email) {
        // Create new user from Apple Sign In
        foundUser = {
          id: `user_${Date.now()}`,
          email,
          name: name || 'Apple User',
          password: `apple_${identityToken}`, // Placeholder
          provider: 'apple',
        };
        users.push(foundUser);
        localStorage.setItem('users', JSON.stringify(users));
      }

      if (!foundUser) {
        throw new Error('Apple Sign In failed');
      }

      // Store session
      const userData = {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
      };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const appleSignup = async (identityToken: string, name: string, email: string) => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Validate inputs
      if (!email || !name) {
        throw new Error('Name and email are required');
      }

      // Get existing users
      const usersJSON = localStorage.getItem('users');
      const users = usersJSON ? JSON.parse(usersJSON) : [];

      // Check if user already exists
      if (users.some((u: any) => u.email === email)) {
        throw new Error('Email already registered');
      }

      // Create new user
      const newUser = {
        id: `user_${Date.now()}`,
        email,
        name,
        password: `apple_${identityToken}`, // Placeholder
        provider: 'apple',
      };

      users.push(newUser);
      localStorage.setItem('users', JSON.stringify(users));

      // Auto-login after signup
      const userData = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        appleLogin,
        appleSignup,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
