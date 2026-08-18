import crypto from 'crypto';
import { getStore, run, get } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sme_procurement_secret_key_2026';

// Standard role accounts
export const PRESET_USERS = {
  admin: { id: 'usr_admin', email: 'admin@supplier-made-easy.co.ke', role: 'admin', name: 'Lead Administrator' },
  buyer: { id: 'usr_buyer', email: 'buyer@supplier-made-easy.co.ke', role: 'buyer', name: 'Senior Buyer' },
  viewer: { id: 'usr_viewer', email: 'viewer@supplier-made-easy.co.ke', role: 'viewer', name: 'Auditor / Viewer' }
};

export function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Authentication Middleware:
 * Inspects Authorization: Bearer <token> or x-api-key or query param ?token=
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const apiKey = req.headers['x-api-key'] || '';
  const queryToken = req.query?.token;

  let token = null;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (apiKey) {
    token = apiKey;
  } else if (queryToken) {
    token = queryToken;
  }

  // Allow preset developer tokens: 'admin-token', 'buyer-token', 'viewer-token'
  if (token === 'admin-token') {
    req.user = PRESET_USERS.admin;
    return next();
  } else if (token === 'buyer-token') {
    req.user = PRESET_USERS.buyer;
    return next();
  } else if (token === 'viewer-token') {
    req.user = PRESET_USERS.viewer;
    return next();
  }

  if (token) {
    const userPayload = verifyToken(token);
    if (userPayload) {
      req.user = userPayload;
    }
  }

  next();
}

/**
 * Require valid authenticated user
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized: Authentication required. Provide Authorization: Bearer <token>'
    });
  }
  next();
}

/**
 * Require specific role(s) (e.g. ['admin', 'buyer'])
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized: Authentication token required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: User role '${req.user.role}' lacks permission for this action (Requires: ${allowedRoles.join(' or ')}).`
      });
    }

    next();
  };
}
