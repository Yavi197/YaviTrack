"use client";

import React from "react";
import { useAuth, AuthLoader } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AppHeader from "@/components/app/app-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return <AuthLoader>{null}</AuthLoader>;
  }

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <AppHeader />
      <div className="w-full px-4 md:px-8 flex-1">{children}</div>
    </div>
  );
}
