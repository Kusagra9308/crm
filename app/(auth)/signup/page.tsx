"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUp } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import Link from "next/link";

function SignUpButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      className="w-full h-11 rounded-lg text-sm font-medium shadow-sm transition-all hover:shadow-md"
      disabled={pending}
    >
      {pending ? "Creating account..." : "Create account"}
    </Button>
  );
}

function SignUpPage() {
  const [errorMessage, dispatch] = useActionState(signUp, undefined);

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-gradient-to-br from-background via-muted/40 to-background">
      {/* LEFT SIDE (UNCHANGED CARD) */}
      <div className="relative flex items-center justify-center px-4">
        {/* subtle glow (keep your vibe) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 blur-3xl rounded-full" />
        </div>

        <Card className="relative w-full max-w-md p-8 space-y-6 rounded-2xl border border-border/50 shadow-xl backdrop-blur-xl bg-background/70">
          <div className="space-y-1 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              Create your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Start building something great ✨
            </p>
          </div>

          <form action={dispatch} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization</Label>
              <Input
                id="orgName"
                name="orgName"
                placeholder="Sharma Enterprises"
                required
                className="h-11 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Rahul Sharma"
                required
                className="h-11 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className="h-11 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                className="h-11 rounded-lg"
              />
            </div>

            <SignUpButton />

            {errorMessage && (
              <p className="text-sm text-red-500 text-center">{errorMessage}</p>
            )}
          </form>

          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>
        </Card>
      </div>

      {/* RIGHT SIDE (NEW PREMIUM PANEL) */}
      <div className="hidden md:flex relative items-center justify-center overflow-hidden">
        {/* animated gradient blobs */}
        <div className="absolute w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl animate-pulse top-10 left-10" />
        <div className="absolute w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-3xl animate-pulse bottom-10 right-10" />

        {/* grid overlay (very premium touch) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

        {/* content */}
        <div className="relative z-10 max-w-sm text-center space-y-4">
          <h2 className="text-2xl font-semibold">
            Build faster. Scale smarter. 🚀
          </h2>
          <p className="text-muted-foreground">
            Your workspace for managing everything in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
export default SignUpPage;
