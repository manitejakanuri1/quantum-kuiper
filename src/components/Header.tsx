'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, LogOut, User } from 'lucide-react';

export function Header() {
    const { data: session } = useSession();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut({ redirect: false });
        router.push('/auth/login');
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/dashboard" className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-black" />
                        </div>
                        <span className="text-lg font-bold text-white">Talk to Site</span>
                    </Link>

                    {/* Right section */}
                    {session && (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-300">{session.user?.email}</span>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="text-sm">Sign out</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
