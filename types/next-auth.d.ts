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
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Session extends CustomSession {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends CustomUser {}
}

declare module "next-auth/jwt" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface JWT extends CustomJWT {}
}