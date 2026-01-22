'use client';

import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface EmbedModalProps {
    agentId: string;
    agentName: string;
    onClose: () => void;
}

export function EmbedModal({ agentId, agentName, onClose }: EmbedModalProps) {
    const [copied, setCopied] = useState(false);

    const embedCode = `<!-- Voice Agent Widget -->
<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/embed.js" 
  data-agent-id="${agentId}"
  data-position="bottom-right"
  data-auto-greet="true">
</script>`;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(embedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 rounded-2xl border border-white/20 w-full max-w-lg shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white">Embed {agentName}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    <p className="text-gray-400 text-sm">
                        Copy and paste this code into your website&apos;s HTML, just before the closing <code className="text-gray-300">&lt;/body&gt;</code> tag.
                    </p>

                    <div className="relative">
                        <pre className="bg-black/50 rounded-xl p-4 text-sm text-gray-300 overflow-x-auto border border-white/10">
                            <code>{embedCode}</code>
                        </pre>
                        <button
                            onClick={handleCopy}
                            className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-black text-sm font-medium transition-colors"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Copy
                                </>
                            )}
                        </button>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <h3 className="text-white font-medium mb-2">Customization Options</h3>
                        <ul className="text-sm text-gray-400 space-y-1">
                            <li>• <code className="text-gray-300">data-position</code>: bottom-right, bottom-left, top-right, top-left</li>
                            <li>• <code className="text-gray-300">data-auto-greet</code>: true or false</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end p-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
