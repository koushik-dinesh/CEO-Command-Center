import { unauthorized } from '../utils/HttpError.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { env } from '../config/env.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
function sanitizeUser(user) {
    return { id: user.id, email: user.email, name: user.name };
}
export class AuthService {
    static async login(email, password) {
        const user = await UserRepository.findByEmail(email);
        if (!user || !user.isActive)
            throw unauthorized('Invalid email or password');
        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches)
            throw unauthorized('Invalid email or password');
        await UserRepository.updateLastLogin(user.id);
        const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: '12h' });
        return { user: sanitizeUser(user), token };
    }
    static async verifyToken(token) {
        try {
            const payload = jwt.verify(token, env.JWT_SECRET);
            if (typeof payload !== 'object' || typeof payload.sub !== 'string')
                return null;
            const user = await UserRepository.findById(payload.sub);
            return user && user.isActive ? sanitizeUser(user) : null;
        }
        catch {
            return null;
        }
    }
}
