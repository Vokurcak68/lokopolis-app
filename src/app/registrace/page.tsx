"use client";

import RegisterForm from "@/components/Auth/RegisterForm";
import { useAuth } from "@/components/Auth/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function RegisterContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultEmail = searchParams.get("email") || undefined;

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 py-16">
      <RegisterForm defaultEmail={defaultEmail} />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]">Načítání...</div>}>
      <RegisterContent />
    </Suspense>
  );
}
