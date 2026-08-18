import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'sme_secure_production_secret_key_2026_uncompromised';
const TOKEN_EXPIRY_SECONDS = 12 * 60 * 60; // 12 hours

export function hashPassword(password, salt = 'sme_salt_2026') {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function verifyPassword(password, storedHash, salt = 'sme_salt_2026') {
  try {
    const calculated = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(calculated, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Production system accounts with secure hashed passwords
export const SYSTEM_USERS = [
  {
    id: 'usr_admin',
    email: 'admin@supplier-made-easy.co.ke',
    passwordHash: hashPassword('AdminPass2026!'),
    role: 'admin',
    name: 'Lead Administrator'
  },
  {
    id: 'usr_buyer',
    email: 'buyer@supplier-made-easy.co.ke',
    passwordHash: hashPassword('BuyerPass2026!'),
    role: 'buyer',
    name: 'Senior Buyer'
  },
  {
    id: 'usr_viewer',
    email: 'viewer@supplier-made-easy.co.ke',
    passwordHash: hashPassword('ViewerPass2026!'),
    role: 'viewer',
    name: 'Auditor / Viewer'
  }
];

export function generateToken(user, expiresInSeconds = TOKEN_EXPIRY_SECONDS) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
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
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expSigBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
      return null; // Invalid signature
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired token
    }

    if (!payload.id || !payload.role) {
      return null; // Malformed payload
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Authentication Middleware:
 * Verifies Authorization: Bearer <signed-jwt>
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
      error: 'Unauthorized: Valid signed authentication token required. Please log in.'
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
