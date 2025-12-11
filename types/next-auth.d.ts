import "next-auth";

interface CustomUser extends User {
  givenName?: string | null;
  familyName?: string | null;
  preferences?: unknown;
}

interface CustomSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    image?: string | null;
    preferences?: unknown;
  };
  accessToken: string;
  refreshToken: string;
  error?: string;
}

interface CustomJWT {
  userId: string;
  email: string;
  name?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  image?: string | null;
  preferences?: unknown;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpires: number;
  error?: string;
}

declare module "next-auth" {
  interface Session extends CustomSession {}
  interface User extends CustomUser {}
}

declare module "next-auth/jwt" {
  interface JWT extends CustomJWT {}
}