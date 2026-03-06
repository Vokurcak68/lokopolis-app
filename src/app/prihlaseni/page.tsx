"use client";

import LoginForm from "@/components/Auth/LoginForm";
import { useAuth } from "@/components/Auth/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 py-16">
      <LoginForm onSuccess={() => router.push("/")} />
    </div>
  );
}
