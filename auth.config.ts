import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isRoot = nextUrl.pathname === '/';
            const isOnLogin = nextUrl.pathname.startsWith('/login');
            const isOnSignUp = nextUrl.pathname.startsWith('/signup');

            // Allow public access to the landing page
            if (isRoot) return true;

            if (isOnLogin || isOnSignUp) {
                if (isLoggedIn) return Response.redirect(new URL('/dashboard', nextUrl));
                return true;
            }

            // Protect all other routes
            if (!isLoggedIn) {
                return false;
            }

            return true;
        },
    },
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig;
