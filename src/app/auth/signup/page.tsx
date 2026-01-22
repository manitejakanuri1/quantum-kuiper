'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                isSignUp: 'true',
                redirect: false
            });

            if (result?.error) {
                setError(result.error);
            } else {
                router.push('/dashboard');
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = (provider: 'google' | 'github') => {
        signIn(provider, { callbackUrl: '/dashboard' });
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Signup Form */}
            <div className="w-full lg:w-1/2 bg-[#0a0a0a] flex flex-col justify-center px-8 sm:px-16 lg:px-24">
                {/* Logo */}
                <div className="mb-12">
                    <h1 className="text-3xl font-bold text-white tracking-tight">Talk to Site</h1>
                </div>

                {/* Welcome Text */}
                <h2 className="text-3xl font-semibold text-white mb-8">Create your account</h2>

                {/* Social Login Buttons */}
                <div className="space-y-3 mb-6">
                    <button
                        onClick={() => handleSocialLogin('google')}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-white/20 text-white hover:bg-white/5 transition-colors"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Sign up with Google
                    </button>
                </div>

                {/* Divider */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/20"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-[#0a0a0a] text-gray-500">Or</span>
                    </div>
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-transparent border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-transparent border border-white/20 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-transparent border border-white/20 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-white/40 transition-colors"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white text-black font-medium py-3 px-4 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-gray-400 border-t-black rounded-full animate-spin mx-auto" />
                        ) : (
                            'Create account'
                        )}
                    </button>
                </form>

                {/* Sign In Link */}
                <p className="mt-6 text-gray-500">
                    Already have an account?{' '}
                    <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 transition-colors">
                        Sign in
                    </Link>
                </p>
            </div>

            {/* Right Side - Feature Showcase */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-gray-50 to-gray-100 flex-col items-center justify-center p-8 overflow-hidden">
                {/* Showcase Image */}
                <div className="flex-1 flex items-center justify-center w-full">
                    <Image
                        src="/auth-showcase.jpg"
                        alt="Feature Showcase"
                        width={800}
                        height={500}
                        className="object-contain max-w-full max-h-[60vh]"
                        priority
                    />
                </div>

                {/* Marketing Text Below Image */}
                <div className="w-full max-w-md text-center mt-8 pb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 whitespace-nowrap">
                        The fastest, ultra-realistic AI Personas platform.
                    </h3>
                    <p className="text-sm text-gray-500 mb-6 whitespace-nowrap">
                        Driving 57% increase in engagement, 25% in conversion and 340% in ROI.
                    </p>
                    <ul className="space-y-2 text-sm text-gray-600 text-left">
                        <li className="flex items-start gap-3">
                            <span className="w-1 h-1 bg-gray-800 rounded-full mt-2 flex-shrink-0"></span>
                            Get instant access to our Slack Community Support
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="w-1 h-1 bg-gray-800 rounded-full mt-2 flex-shrink-0"></span>
                            Share and publish your AI Personas
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="w-1 h-1 bg-gray-800 rounded-full mt-2 flex-shrink-0"></span>
                            Track progress with our Analytics dashboards
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
