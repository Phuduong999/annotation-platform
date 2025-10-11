import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // 7 days for remember me

// Dev mode: Hardcoded users (passwords in plain text for dev only)
const DEV_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'admin',
    password: 'admin123',
    email: 'admin@monorepo.local',
    full_name: 'Administrator',
    role: 'admin' as const,
    is_active: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    username: 'user123',
    password: 'user123',
    email: 'user123@monorepo.local',
    full_name: 'Test User 123',
    role: 'annotator' as const,
    is_active: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    username: 'viewer1',
    password: 'viewer123',
    email: 'viewer1@monorepo.local',
    full_name: 'Viewer User',
    role: 'viewer' as const,
    is_active: true,
  },
];

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'annotator' | 'viewer';
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthToken {
  token: string;
  user: Omit<User, 'password_hash'>;
  expiresAt: Date;
}

export class AuthService {
  /**
   * Login user with username/password (DEV MODE - Simple authentication)
   */
  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const { username, password, rememberMe } = credentials;

    // Find user in hardcoded list
    const user = DEV_USERS.find(u => u.username === username);

    if (!user) {
      throw new Error('Invalid username or password');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new Error('User account is disabled');
    }

    // Verify password (plain text comparison for dev mode)
    if (password !== user.password) {
      throw new Error('Invalid username or password');
    }

    // Generate JWT token
    const expiresIn = rememberMe ? JWT_EXPIRES_IN : '24h';
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn }
    );

    // Calculate expiration date
    const expiresAt = new Date();
    if (rememberMe) {
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    } else {
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      token,
      user: userWithoutPassword,
      expiresAt,
    };
  }

  /**
   * Logout user (no-op in dev mode)
   */
  async logout(token: string): Promise<void> {
    // In dev mode with JWT, we just rely on client to delete the token
    // No server-side session invalidation needed
  }

  /**
   * Verify JWT token and return user
   */
  async verifyToken(token: string): Promise<User> {
    try {
      // Verify JWT
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        username: string;
        role: string;
      };

      // Find user in hardcoded list
      const user = DEV_USERS.find(u => u.id === decoded.userId);

      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      throw error;
    }
  }

  /**
   * Get user by token
   */
  async getUserByToken(token: string): Promise<User> {
    return this.verifyToken(token);
  }
}

// Export singleton instance
export const authService = new AuthService();
