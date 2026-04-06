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
    <div className="bg-[#fbfcff] min-h-screen flex flex-col relative overflow-hidden print:bg-white selection:bg-amber-100 italic-selection">
      {/* Premium Ambient Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-40">
        <div className="absolute top-[-10%] right-[-5%] w-[45%] h-[45%] bg-blue-100/50 blur-[120px] rounded-full animate-pulse-slow" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[45%] h-[45%] bg-indigo-50/50 blur-[120px] rounded-full animate-pulse-slow-delay" />
        <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-emerald-50/30 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        <div className="print:hidden">
          <AppHeader />
        </div>
        <main className="w-full px-4 md:px-8 py-2 md:py-3 flex-1 print:p-0 print:m-0 scroll-smooth custom-scrollbar">
          <div className="max-w-[1600px] mx-auto animate-in fade-in duration-700">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
