'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AVAILABLE_FACES } from '@/lib/simile';

// Agent template roles for each avatar
const agentRoles: Record<string, string> = {
    'cace3ef7-a4c4-425d-a8cf-a5358eb0c427': 'Sales Agent',
    '7e74d6e7-d559-4394-bd56-4923a3ab75ad': 'Customer Support',
    'f0ba4efe-7946-45de-9955-c04a04c367b9': 'Language Tutor',
    '804c347a-26c9-4dcf-bb49-13df4bed61e8': 'Negotiator',
};

export function AgentTemplates() {
    return (
        <section className="mb-10">
            <h2 className="text-xl font-semibold text-white mb-6">Agent Templates</h2>

            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {AVAILABLE_FACES.map((face) => (
                    <Link
                        key={face.id}
                        href={`/create?face=${face.id}`}
                        className="group flex-shrink-0 w-36 cursor-pointer"
                    >
                        {/* Avatar Image */}
                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 ring-1 ring-white/20 transition-all group-hover:ring-2 group-hover:ring-white/50">
                            <Image
                                src={face.thumbnail}
                                alt={face.name}
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                sizes="144px"
                            />
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {/* Name and Role */}
                        <p className="text-sm text-white font-medium">
                            {face.name} - <span className="text-gray-400">{agentRoles[face.id] || 'Agent'}</span>
                        </p>
                    </Link>
                ))}

                {/* Create Your Own Card */}
                <Link
                    href="/create"
                    className="group flex-shrink-0 w-36 cursor-pointer"
                >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 border-2 border-dashed border-white/30 flex items-center justify-center bg-white/5 transition-all group-hover:border-white/50 group-hover:bg-white/10">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                <Plus className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                            </div>
                        </div>
                    </div>
                    <p className="text-sm text-gray-400 group-hover:text-white transition-colors">
                        Create Your Own
                    </p>
                </Link>
            </div>
        </section>
    );
}
