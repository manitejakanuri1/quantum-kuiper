// NextAuth Configuration
// Email + password authentication
// @ts-nocheck - NextAuth v5 beta has incompatible types

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getUserByEmail, createUser } from './db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Require AUTH_SECRET in production
if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET must be set in production environment');
}

// Validate AUTH_SECRET strength
if (!process.env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET environment variable is required');
}

if (process.env.AUTH_SECRET.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters for security');
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    trustHost: true,
    secret: process.env.AUTH_SECRET,
    providers: [
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                isSignUp: { label: 'Sign Up', type: 'text' }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password are required');
                }

                const email = credentials.email as string;
                const password = credentials.password as string;
                const isSignUp = (credentials as { isSignUp?: string }).isSignUp === 'true';

                if (isSignUp) {
                    // Check if user already exists
                    const existingUser = await getUserByEmail(email);
                    if (existingUser) {
                        throw new Error('User already exists');
                    }

                    // Hash password with bcrypt (10 rounds)
                    const hashedPassword = await bcrypt.hash(password, 10);

                    // Create new user with hashed password
                    const newUser = await createUser({
                        id: uuidv4(),
                        email,
                        password: hashedPassword,
                        createdAt: new Date()
                    });

                    return {
                        id: newUser.id,
                        email: newUser.email
                    };
                } else {
                    // Login
                    const user = await getUserByEmail(email);
                    if (!user) {
                        throw new Error('User not found');
                    }

                    // Compare hashed passwords using bcrypt
                    const isValidPassword = await bcrypt.compare(password, user.password);
                    if (!isValidPassword) {
                        throw new Error('Invalid password');
                    }

                    return {
                        id: user.id,
                        email: user.email
                    };
                }
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token.id) {
                session.user.id = token.id as string;
            }
            return session;
        }
    },
    pages: {
        signIn: '/auth/login',
        error: '/auth/login'
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    }
});
