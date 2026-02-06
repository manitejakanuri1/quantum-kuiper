'use client';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Settings, User, Bell, Shield, Palette } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="min-h-screen bg-black flex">
            <DashboardSidebar />

            <main className="flex-1 ml-56 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-white">Settings</h1>
                        <p className="text-gray-400 mt-1">Manage your account preferences</p>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-[#111111] rounded-2xl border border-white/5 p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                    <User className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium">Profile</h3>
                                    <p className="text-sm text-gray-400">Manage your personal information</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#111111] rounded-2xl border border-white/5 p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                    <Bell className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium">Notifications</h3>
                                    <p className="text-sm text-gray-400">Configure email and push notifications</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#111111] rounded-2xl border border-white/5 p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium">Security</h3>
                                    <p className="text-sm text-gray-400">Password and two-factor authentication</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
