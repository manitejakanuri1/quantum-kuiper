'use client';

import { DashboardSidebar } from '@/components/DashboardSidebar';
import { CreditCard, Check, Zap } from 'lucide-react';

const plans = [
    {
        name: 'Free',
        price: '$0',
        period: '/month',
        features: ['100 minutes/month', '1 agent', 'Basic avatars', 'Community support'],
        current: true
    },
    {
        name: 'Pro',
        price: '$49',
        period: '/month',
        features: ['1,000 minutes/month', '5 agents', 'All avatars', 'Priority support', 'Custom branding'],
        current: false
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        features: ['Unlimited minutes', 'Unlimited agents', 'Custom avatars', 'Dedicated support', 'SLA guarantee'],
        current: false
    },
];

export default function SubscriptionPage() {
    return (
        <div className="min-h-screen bg-black flex">
            <DashboardSidebar />

            <main className="flex-1 ml-56 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Subscription</h1>
                            <p className="text-gray-400 mt-1">Manage your plan and billing</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {plans.map((plan) => (
                            <div
                                key={plan.name}
                                className={`bg-[#111111] rounded-2xl border p-6 ${plan.current ? 'border-white/20' : 'border-white/5'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-medium text-white">{plan.name}</h3>
                                    {plan.current && (
                                        <span className="px-2 py-1 text-xs font-medium bg-white/10 text-white rounded">
                                            Current
                                        </span>
                                    )}
                                </div>
                                <div className="mb-6">
                                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                                    <span className="text-gray-400">{plan.period}</span>
                                </div>
                                <ul className="space-y-3 mb-6">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-center gap-2 text-sm text-gray-400">
                                            <Check className="w-4 h-4 text-white" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${plan.current
                                            ? 'bg-white/5 text-gray-400 cursor-default'
                                            : 'bg-white text-black hover:bg-gray-100'
                                        }`}
                                    disabled={plan.current}
                                >
                                    {plan.current ? 'Current Plan' : 'Upgrade'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
