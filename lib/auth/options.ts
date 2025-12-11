import { NextAuthOptions, User, JWT } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "../../lib/prisma";
import { verifyPassword, isEmailAllowed } from "./utils";

const ACCESS_TOKEN_TTL = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || "900"); // 15 minutes
const REFRESH_TOKEN_TTL = parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS || "2592000"); // 30 days

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: parseInt(process.env.SESSION_TTL_SECONDS || "2592000") // 30 days
  },
  pages: {
    signIn: "/signin",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Check if email is allowed
        if (!isEmailAllowed(credentials.email)) {
          throw new Error("Email domain not allowed");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          givenName: user.givenName,
          familyName: user.familyName,
          image: user.image,
          preferences: user.preferences
        } satisfies User;
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers, check whitelist
      if (account?.provider !== "credentials" && user?.email) {
        if (!isEmailAllowed(user.email)) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      // Initial sign in
      if (user && account) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.givenName = user.givenName;
        token.familyName = user.familyName;
        token.image = user.image;
        token.preferences = user.preferences;

        // Create refresh token for initial sign in
        const refreshTokenValue = await createRefreshToken(token.userId as string);
        token.refreshToken = refreshTokenValue;
        token.refreshTokenExpires = Date.now() + (REFRESH_TOKEN_TTL * 1000);
      }

      // Handle session updates
      if (trigger === "update" && session) {
        Object.assign(token, session);
      }

      // Sign JWT tokens
      if (token.userId) {
        try {
          const { SignJWT } = await import("jose");
          const secret = new TextEncoder().encode(process.env.JWT_SECRET);

          const accessToken = await new SignJWT({
            userId: token.userId,
            email: token.email,
            type: "access"
          })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
            .sign(secret);

          token.accessToken = accessToken;
        } catch (error) {
          console.error("Error signing JWT:", error);
        }
      }

      // Check if token needs refresh
      if (token.refreshToken && token.refreshTokenExpires && Date.now() > token.refreshTokenExpires) {
        try {
          const newToken = await refreshAccessToken(token);
          return newToken;
        } catch (error) {
          console.error("Error refreshing access token:", error);
          token.error = "RefreshAccessTokenError";
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.userId as string,
          email: token.email as string,
          name: token.name as string,
          givenName: token.givenName as string,
          familyName: token.familyName as string,
          image: token.image as string,
          preferences: token.preferences as any
        };
        session.accessToken = token.accessToken as string;
        session.refreshToken = token.refreshToken as string;
        session.error = token.error as string;
      }
      return session;
    }
  },
  events: {
    async signOut({ token }) {
      // Revoke refresh token on sign out
      if (token && token.refreshToken) {
        await revokeRefreshToken(token.refreshToken);
      }
    }
  }
};

// Helper functions
async function createRefreshToken(userId: string): Promise<string> {
  const crypto = await import("crypto");
  const tokenValue = crypto.randomBytes(64).toString("hex");
  
  const expiresAt = new Date(Date.now() + (REFRESH_TOKEN_TTL * 1000));
  
  await prisma.refreshToken.create({
    data: {
      userId,
      token: tokenValue,
      expiresAt
    }
  });
  
  return tokenValue;
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    throw new Error("No refresh token");
  }

  // Verify refresh token exists and is not revoked
  const refreshTokenRecord = await prisma.refreshToken.findUnique({
    where: { token: token.refreshToken }
  });

  if (!refreshTokenRecord || refreshTokenRecord.revokedAt || refreshTokenRecord.expiresAt < new Date()) {
    throw new Error("Invalid refresh token");
  }

  // Rotate refresh token
  await prisma.refreshToken.update({
    where: { token: token.refreshToken },
    data: { revokedAt: new Date() }
  });

  const newRefreshToken = await createRefreshToken(token.userId as string);
  
  return {
    ...token,
    refreshToken: newRefreshToken,
    refreshTokenExpires: Date.now() + (REFRESH_TOKEN_TTL * 1000),
  };
}

async function revokeRefreshToken(tokenValue: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token: tokenValue },
    data: { revokedAt: new Date() }
  });
}