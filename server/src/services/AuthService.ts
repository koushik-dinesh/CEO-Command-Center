import { unauthorized } from '../utils/HttpError.js';
import { UserRepository } from '../repositories/UserRepository.js';
import type { UserRow } from '../db/types.js';
import { env } from '../config/env.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

function sanitizeUser(user: Pick<UserRow, 'id' | 'email' | 'name'>): AuthUser {
  return { id: user.id, email: user.email, name: user.name };
}

export class AuthService {
  static async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const user = await UserRepository.findByEmail(email);
    if (!user || !user.isActive) throw unauthorized('Invalid email or password');

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) throw unauthorized('Invalid email or password');

    await UserRepository.updateLastLogin(user.id);
    const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: '12h' });
    return { user: sanitizeUser(user), token };
  }

  static async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (typeof payload !== 'object' || typeof payload.sub !== 'string') return null;
      const user = await UserRepository.findById(payload.sub);
      return user && user.isActive ? sanitizeUser(user) : null;
    } catch {
      return null;
    }
  }
}
