"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, gateEnabled, sessionTokenFor } from "@/lib/auth";

const ONE_WEEK = 60 * 60 * 24 * 7;

function safeNext(value: FormDataEntryValue | null): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!gateEnabled() || password !== process.env.DEMO_PASSWORD) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const store = await cookies();
  store.set(AUTH_COOKIE, await sessionTokenFor(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK,
  });
  redirect(next);
}

export async function logout() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  redirect("/login");
}
