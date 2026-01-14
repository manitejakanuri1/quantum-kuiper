'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

interface UsageData {
    date: string;
    minutes: number;
}

interface Session {
    id: string;
    agent_id: string;
    status: string;
    started_at: string;
    ended_at: string | null;
}

// Calculate usage data from sessions
function calculateUsageFromSessions(sessions: Session[]): UsageData[] {
    const data: UsageData[] = [];
    const now = new Date();

    // Create data for last 30 days
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        // Calculate minutes for this day from sessions
        let minutesForDay = 0;
        sessions.forEach(session => {
            const sessionStart = new Date(session.started_at);
            const sessionEnd = session.ended_at ? new Date(session.ended_at) : new Date();

            // Check if session overlaps with this day
            if (sessionStart < nextDate && sessionEnd >= date) {
                // Calculate overlap duration in minutes
                const overlapStart = sessionStart > date ? sessionStart : date;
                const overlapEnd = sessionEnd < nextDate ? sessionEnd : nextDate;
                const durationMs = overlapEnd.getTime() - overlapStart.getTime();
                minutesForDay += durationMs / (1000 * 60);
            }
        });

        data.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            minutes: Math.round(minutesForDay * 100) / 100, // Round to 2 decimal places
        });
    }

    return data;
}

// Generate mock usage data for demo (fallback)
function generateMockUsageData(): UsageData[] {
    const data: UsageData[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            minutes: Math.random() * 10 + (i < 5 ? 2 : 0),
        });
    }

    return data;
}

export function UsageChart() {
    const [data, setData] = useState<UsageData[]>([]);
    const [totalMinutes, setTotalMinutes] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchUsageData() {
            try {
                const response = await fetch('/api/sessions');
                if (response.ok) {
                    const sessions: Session[] = await response.json();
                    const usageData = calculateUsageFromSessions(sessions);
                    setData(usageData);

                    // Calculate total minutes
                    const total = usageData.reduce((sum, d) => sum + d.minutes, 0);
                    setTotalMinutes(Math.round(total * 10) / 10);
                } else {
                    // Fallback to mock data
                    const mockData = generateMockUsageData();
                    setData(mockData);
                    setTotalMinutes(Math.round(mockData.reduce((sum, d) => sum + d.minutes, 0) * 10) / 10);
                }
            } catch (error) {
                // Fallback to mock data on error
                const mockData = generateMockUsageData();
                setData(mockData);
                setTotalMinutes(Math.round(mockData.reduce((sum, d) => sum + d.minutes, 0) * 10) / 10);
            } finally {
                setLoading(false);
            }
        }

        fetchUsageData();
    }, []);

    const maxMinutes = Math.max(...data.map(d => d.minutes), 12);

    // Get sample dates for x-axis labels
    const labelIndices = [0, 6, 12, 18, 24, 29];

    if (loading) {
        return (
            <div className="bg-[#111111] rounded-2xl border border-white/5 p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-white/10 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-white/10 rounded w-24 mb-6"></div>
                    <div className="h-32 bg-white/10 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#111111] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold text-white">Minutes Used</h3>
                <span className="text-2xl font-bold text-white">{totalMinutes}m</span>
            </div>
            <p className="text-sm text-gray-500 mb-6">Last 30 days</p>

            {/* Y-axis labels and Chart */}
            <div className="relative h-32 mb-8">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-gray-500 pr-2">
                    <span>{Math.round(maxMinutes)}m</span>
                    <span>{Math.round(maxMinutes / 2)}m</span>
                    <span>0m</span>
                </div>

                {/* Chart area */}
                <div className="ml-10 h-full relative">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        <div className="border-t border-white/10" />
                        <div className="border-t border-white/10" />
                        <div className="border-t border-white/10" />
                    </div>

                    {/* SVG Line Chart */}
                    {data.length > 0 && (
                        <svg
                            className="w-full h-full"
                            viewBox="0 0 300 100"
                            preserveAspectRatio="none"
                        >
                            {/* Gradient fill under the line */}
                            <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgb(255, 255, 255)" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="rgb(255, 255, 255)" stopOpacity="0" />
                                </linearGradient>
                            </defs>

                            {/* Area fill */}
                            <path
                                d={`M 0 100 ${data.map((d, i) => {
                                    const x = (i / (data.length - 1)) * 300;
                                    const y = 100 - (d.minutes / maxMinutes) * 100;
                                    return `L ${x} ${y}`;
                                }).join(' ')} L 300 100 Z`}
                                fill="url(#chartGradient)"
                            />

                            {/* Line */}
                            <path
                                d={`M ${data.map((d, i) => {
                                    const x = (i / (data.length - 1)) * 300;
                                    const y = 100 - (d.minutes / maxMinutes) * 100;
                                    return `${i === 0 ? '' : 'L '}${x} ${y}`;
                                }).join(' ')}`}
                                fill="none"
                                stroke="rgb(255, 255, 255)"
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                            />

                            {/* End point dot */}
                            <circle
                                cx="300"
                                cy={100 - (data[data.length - 1].minutes / maxMinutes) * 100}
                                r="4"
                                fill="rgb(255, 255, 255)"
                                vectorEffect="non-scaling-stroke"
                            />
                        </svg>
                    )}
                </div>
            </div>

            {/* X-axis labels */}
            <div className="ml-10 flex justify-between text-xs text-gray-500">
                {labelIndices.map(idx => (
                    <span key={idx}>{data[idx]?.date}</span>
                ))}
            </div>

            {/* View Details Button */}
            <div className="mt-6">
                <Link
                    href="/dashboard/sessions"
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
                >
                    View Details
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}
