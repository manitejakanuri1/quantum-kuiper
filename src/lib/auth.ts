// NextAuth Configuration
// Email + password authentication
// @ts-nocheck - NextAuth v5 beta has incompatible types

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getUserByEmail, createUser } from './db';
import { v4 as uuidv4 } from 'uuid';

export const { handlers, auth, signIn, signOut } = NextAuth({
    trustHost: true,
    secret: process.env.AUTH_SECRET || 'development-secret-change-in-production',
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

                    // Create new user
                    const newUser = await createUser({
                        id: uuidv4(),
                        email,
                        password, // In production, hash with bcrypt
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

                    // In production, compare hashed passwords
                    if (user.password !== password) {
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
        strategy: 'jwt'
    }
});
