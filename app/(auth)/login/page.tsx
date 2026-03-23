'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { authenticate } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

function LoginButton() {
    const { pending } = useFormStatus();

    return (
        <Button
            className="w-full h-11 rounded-lg text-sm font-medium shadow-sm transition-all hover:shadow-md"
            disabled={pending}
        >
            {pending ? 'Signing in...' : 'Sign in'}
        </Button>
    );
}

export default function LoginPage() {
    const [errorMessage, dispatch] = useActionState(authenticate, undefined);

    return (
        <div className="min-h-screen grid md:grid-cols-2 bg-gradient-to-br from-background via-muted/40 to-background">
            
            {/* LEFT SIDE (FORM) */}
            <div className="relative flex items-center justify-center px-4">
                
                {/* glow */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 blur-3xl rounded-full" />
                </div>

                <Card className="relative w-full max-w-md p-8 space-y-6 rounded-2xl border border-border/50 shadow-xl backdrop-blur-xl bg-background/70">
                    
                    <div className="space-y-1 text-center">
                        <h1 className="text-3xl font-semibold tracking-tight">
                            Welcome back
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Sign in to continue 🚀
                        </p>
                    </div>

                    <form action={dispatch} className="space-y-5">
                        
                        <div className="space-y-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="rahul.sharma@example.com"
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
                                className="h-11 rounded-lg"
                            />
                        </div>

                        <LoginButton />

                        {errorMessage && (
                            <p className="text-sm text-red-500 text-center">
                                {errorMessage}
                            </p>
                        )}
                    </form>

                    <div className="text-center text-sm text-muted-foreground border-t pt-4 space-y-3">
                        <p>
                            Don&apos;t have an account?{' '}
                            <Link href="/signup" className="font-medium text-primary hover:underline">
                                Sign up
                            </Link>
                        </p>

                        {/* demo account */}
                        <div className="text-xs bg-muted/50 rounded-lg p-3">
                            <p className="font-semibold">Demo Account</p>
                            <p>Email: user@example.com</p>
                            <p>Password: password123</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* RIGHT SIDE (ANIMATED PANEL) */}
            <div className="hidden md:flex relative items-center justify-center overflow-hidden">
                
                {/* animated blobs */}
                <div className="absolute w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl animate-pulse top-10 left-10" />
                <div className="absolute w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-3xl animate-pulse bottom-10 right-10" />

                {/* grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

                {/* content */}
                <div className="relative z-10 max-w-sm text-center space-y-4">
                    <h2 className="text-2xl font-semibold">
                        Welcome back 👋
                    </h2>
                    <p className="text-muted-foreground">
                        Pick up where you left off and keep building.
                    </p>
                </div>
            </div>
        </div>
    );
}