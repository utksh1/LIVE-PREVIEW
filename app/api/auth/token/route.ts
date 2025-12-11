import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCookies, setAuthCookie, clearAuthCookie } from "@/lib/auth/utils";

const REFRESH_TOKEN_TTL = parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS || "2592000"); // 30 days

export async function POST(request: NextRequest) {
  try {
    const cookies = parseCookies(request.headers.get("cookie"));
    const refreshToken = cookies["refresh-token"];

    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token provided" }, { status: 401 });
    }

    // Verify refresh token exists and is not revoked
    const refreshTokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!refreshTokenRecord || refreshTokenRecord.revokedAt || refreshTokenRecord.expiresAt < new Date()) {
      const response = NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
      response.headers.append("Set-Cookie", clearAuthCookie("refresh-token"));
      return response;
    }

    // Rotate refresh token
    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revokedAt: new Date() }
    });

    const crypto = await import("crypto");
    const newRefreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + (REFRESH_TOKEN_TTL * 1000));

    await prisma.refreshToken.create({
      data: {
        userId: refreshTokenRecord.userId,
        token: newRefreshToken,
        expiresAt
      }
    });

    // Generate new access token
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    const accessToken = await new SignJWT({
      userId: refreshTokenRecord.userId,
      email: refreshTokenRecord.user.email,
      type: "access"
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || "900")}s`)
      .sign(secret);

    const response = NextResponse.json({
      accessToken,
      user: {
        id: refreshTokenRecord.user.id,
        email: refreshTokenRecord.user.email,
        name: refreshTokenRecord.user.name,
        image: refreshTokenRecord.user.image,
        preferences: refreshTokenRecord.user.preferences
      }
    });

    // Set new refresh token cookie
    response.headers.append("Set-Cookie", 
      setAuthCookie("refresh-token", newRefreshToken, REFRESH_TOKEN_TTL)
    );

    return response;
  } catch (error) {
    console.error("Token refresh error:", error);
    const response = NextResponse.json({ error: "Token refresh failed" }, { status: 500 });
    response.headers.append("Set-Cookie", clearAuthCookie("refresh-token"));
    return response;
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookies = parseCookies(request.headers.get("cookie"));
    const refreshToken = cookies["refresh-token"];

    if (refreshToken) {
      // Revoke the refresh token
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revokedAt: new Date() }
      });
    }

    const response = NextResponse.json({ success: true });
    response.headers.append("Set-Cookie", clearAuthCookie("refresh-token"));
    return response;
  } catch (error) {
    console.error("Token revocation error:", error);
    return NextResponse.json({ error: "Token revocation failed" }, { status: 500 });
  }
}