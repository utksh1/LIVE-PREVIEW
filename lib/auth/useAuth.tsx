"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  const isUnauthenticated = status === "unauthenticated";

  const user = session?.user;
  const accessToken = session?.accessToken as string | undefined;
  const refreshToken = session?.refreshToken as string | undefined;
  const error = session?.error as string | undefined;

  // Redirect to sign in if not authenticated
  const requireAuth = () => {
    if (isUnauthenticated) {
      router.push("/signin");
    }
  };

  // Refresh access token manually
  const refreshAccessToken = async () => {
    try {
      const response = await fetch("/api/auth/token", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh token");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Token refresh failed:", error);
      router.push("/signin");
      throw error;
    }
  };

  // Logout
  const logout = async () => {
    try {
      await fetch("/api/auth/token", {
        method: "DELETE",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      router.push("/signin");
    }
  };

  return {
    session,
    user,
    accessToken,
    refreshToken,
    error,
    isLoading,
    isAuthenticated,
    isUnauthenticated,
    requireAuth,
    refreshAccessToken,
    logout,
  };
}