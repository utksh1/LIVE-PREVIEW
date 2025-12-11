import * as crypto from "crypto";

const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || "").split(",").map(d => d.trim()).filter(Boolean);

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(salt + ":" + derivedKey.toString("hex"));
    });
  });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(":");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString("hex"));
    });
  });
}

export function isEmailAllowed(email: string): boolean {
  if (ALLOWED_DOMAINS.length === 0) {
    return true; // No whitelist configured, allow all
  }
  
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

export function extractDomain(email: string): string | null {
  return email.split("@")[1]?.toLowerCase() || null;
}

export function generateRandomToken(length: number = 64): string {
  return crypto.randomBytes(length).toString("hex");
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {} as Record<string, string>);
}

export function setAuthCookie(
  name: string, 
  value: string, 
  maxAgeSeconds: number, 
  options: { httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none" } = {}
) {
  const defaultOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: maxAgeSeconds,
    path: "/"
  };

  return `${name}=${encodeURIComponent(value)}; ${Object.entries({ ...defaultOptions, ...options })
    .map(([key, value]) => {
      if (key === "maxAge") return `Max-Age=${value}`;
      if (value === true) return key;
      if (value === false) return "";
      return `${key.charAt(0).toUpperCase()}${key.slice(1)}=${value}`;
    })
    .filter(Boolean)
    .join("; ")}`;
}

export function clearAuthCookie(name: string): string {
  return `${name}=; HttpOnly; Secure; SameSite=lax; Max-Age=0; Path=/`;
}