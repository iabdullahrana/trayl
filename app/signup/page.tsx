import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign up | Trayl" };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
