# Next.js Authentication with NextAuth & OAuth

A complete authentication system built with NextAuth.js v5, featuring email/password credentials, OAuth providers (Google & GitHub), JWT-based access tokens, and refresh token rotation.

## Features

- **Credentials Authentication**: Email/password with bcrypt password hashing
- **OAuth Providers**: Google and GitHub integration
- **JWT Strategy**: Short-lived access tokens (15 min default) using JOSE
- **Refresh Token Rotation**: Long-lived refresh tokens (30 days default) with rotation
- **Whitelist Support**: Domain-based email restriction (optional)
- **Cookie Management**: HttpOnly secure cookies for refresh tokens
- **Session Persistence**: User preferences and profile data in sessions

## Getting Started

### 1. Environment Variables

Copy the example environment file and configure your secrets:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Database
DATABASE_URL="file:./dev.db"

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-nextauth-secret"
JWT_SECRET="your-jwt-signing-secret"

# OAuth Providers
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_ID="your-github-client-id"
GITHUB_SECRET="your-github-client-secret"

# Whitelist (optional)
ALLOWED_DOMAINS="example.com,company.com"

# Token TTLs (optional)
ACCESS_TOKEN_TTL_SECONDS=900      # 15 minutes
REFRESH_TOKEN_TTL_SECONDS=2592000 # 30 days
SESSION_TTL_SECONDS=2592000       # 30 days
```

### 2. OAuth Setup

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client
5. Set authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Secret to your `.env`

#### GitHub OAuth
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Secret to your `.env`

### 3. Database Setup

Run Prisma migrations to create the required tables:

```bash
npx prisma migrate dev --name auth-setup
npx prisma generate
```

## Authentication Flow

### Cookie Management

The system uses two main cookies:

- **Session Cookie**: Handled by NextAuth (contains session data)
- **Refresh Token Cookie**: HttpOnly cookie `refresh-token` for token rotation

### Token Flow

1. **Initial Login**: User signs in via credentials or OAuth
2. **Access Token**: JWT token issued with 15-minute expiry
3. **Refresh Token**: Stored in database, rotated on each refresh
4. **Auto-Refresh**: NextAuth automatically refreshes expired tokens
5. **Logout**: Revokes refresh token and clears cookies

## API Routes

### `/api/auth/[...nextauth]`
NextAuth endpoint handling all authentication requests.

### `/api/auth/token`
Token refresh and revocation endpoint:

- `POST /api/auth/token` - Refresh access token using refresh token cookie
- `DELETE /api/auth/token` - Revoke refresh token (logout)

## Usage Examples

### Client-Side Authentication

```tsx
import { useAuth } from "@/lib/auth/useAuth";

function MyComponent() {
  const {
    user,
    isAuthenticated,
    isLoading,
    logout,
    refreshAccessToken
  } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  
  if (!isAuthenticated) {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      <button onClick={logout}>Sign Out</button>
    </div>
  );
}
```

### Server-Side Authentication

```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export default async function MyServerComponent() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return <div>Please sign in</div>;
  }

  return <div>Hello, {session.user?.name}!</div>;
}
```

### API Route Protection

```tsx
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Your protected API logic here
  return NextResponse.json({ data: "Protected data" });
}
```

## User Management

### Creating Users

Users are automatically created when:
- Signing in with OAuth for the first time
- Creating an account via credentials (implement your own signup flow)

### Password Management

For credentials-based authentication, hash passwords before storing:

```typescript
import { hashPassword } from "@/lib/auth/utils";

const hashedPassword = await hashPassword("user-password");

// Store in user record
await prisma.user.update({
  where: { id: userId },
  data: { passwordHash: hashedPassword }
});
```

### Whitelist Configuration

Restrict sign-ins to specific email domains:

```env
ALLOWED_DOMAINS="company.com,partner.com"
```

Leave empty to allow all domains.

## Architecture

### Database Schema

The Prisma schema includes:
- `User` - Core user information and preferences
- `Account` - OAuth account linking
- `Session` - NextAuth session management
- `RefreshToken` - Token rotation tracking
- `PasswordResetToken` - Password reset functionality

### File Structure

```
lib/auth/
├── options.ts      # NextAuth configuration
├── utils.ts        # Password hashing, whitelist, cookies
└── useAuth.tsx     # React hook for auth state

app/
├── api/auth/[...nextauth]/    # NextAuth route handler
├── api/auth/token/            # Token refresh endpoint
└── (auth)/signin/            # Sign-in page
```

## Security Considerations

- Refresh tokens are HttpOnly cookies (not accessible via JavaScript)
- Access tokens are short-lived (15 minutes)
- Refresh tokens are rotated on each use
- Passwords are hashed using scrypt
- OAuth state validation prevents CSRF attacks
- All tokens are signed with JWT_SECRET

## Deployment

For production deployment:

1. Set all environment variables with production values
2. Update `NEXTAUTH_URL` to your domain
3. Add production OAuth redirect URIs
4. Use HTTPS to enable secure cookies
5. Set strong secrets for `NEXTAUTH_SECRET` and `JWT_SECRET`

## Development

```bash
# Start development server
npm run dev

# Database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Database studio (optional)
npx prisma studio
```

The auth system is now ready to use! Users can sign in with email/password or via Google/GitHub OAuth, and the system will automatically handle token refresh and session management.