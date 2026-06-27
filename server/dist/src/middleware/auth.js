import { env } from '../config/env.js';
import { AuthService } from '../services/AuthService.js';
export async function requireAuth(req, res, next) {
    const cookieToken = req.cookies?.[env.AUTH_COOKIE_NAME];
    const bearerToken = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    const token = cookieToken ?? bearerToken;
    if (!token) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }
    const user = await AuthService.verifyToken(token);
    if (!user) {
        res.status(401).json({ message: 'Invalid or expired session' });
        return;
    }
    req.user = user;
    next();
}
