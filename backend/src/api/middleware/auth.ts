import { Request, Response, NextFunction } from "express";
import { SiweMessage } from "siwe";

/**
 * SIWE (Sign-In with Ethereum / EIP-4361) authentication middleware.
 *
 * Clients POST to /auth/login with { message, signature }.
 * The middleware verifies the signature and sets req.walletAddress.
 * Subsequent requests pass the session token via Authorization header.
 */

// In-memory session store (swap for Redis in production)
const sessions: Map<string, { address: string; expiresAt: number }> = new Map();

declare global {
  namespace Express {
    interface Request {
      walletAddress?: string;
    }
  }
}

/** Verify SIWE message and create a session. Returns session token. */
export async function createSession(
  message: string,
  signature: string
): Promise<{ token: string; address: string }> {
  const siweMessage = new SiweMessage(message);
  const { data } = await siweMessage.verify({ signature });

  const token = crypto.randomUUID();
  sessions.set(token, {
    address: data.address.toLowerCase(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
  });

  return { token, address: data.address };
}

/** Express middleware: require a valid session token in Authorization header. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const token = header.slice(7);
  const session = sessions.get(token);

  if (!session) {
    res.status(401).json({ error: "Invalid session token" });
    return;
  }

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    res.status(401).json({ error: "Session expired" });
    return;
  }

  req.walletAddress = session.address;
  next();
}

/** Optional auth: sets walletAddress if token present, but doesn't reject. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const session = sessions.get(header.slice(7));
    if (session && session.expiresAt > Date.now()) {
      req.walletAddress = session.address;
    }
  }
  next();
}
