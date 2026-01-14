'use client';

import Image from 'next/image';

export default function AuthShowcase() {
    return (
        <div className="relative w-full h-full flex items-center justify-center p-8">
            <div className="relative w-[900px] h-[700px]">
                {/* Real-Time ROI Card - Top Left */}
                <div className="absolute top-0 left-0 w-[480px] bg-white rounded-[32px] shadow-[0_16px_50px_rgba(0,0,0,0.08)] p-8 z-10 border border-gray-100">
                    <h3 className="text-[28px] font-bold text-gray-900 mb-8">Real-Time ROI</h3>

                    {/* First Entry - Kyle */}
                    <div className="flex items-start gap-5 mb-6">
                        <div className="w-[72px] h-[72px] rounded-full overflow-hidden ring-2 ring-gray-200 flex-shrink-0">
                            <Image
                                src="/faces/mark.png"
                                alt="Kyle"
                                width={72}
                                height={72}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-400 mb-1">11:56</p>
                            <p className="text-[15px] text-gray-800 leading-relaxed">
                                Kyle converted 43 new customers
                            </p>
                            <p className="text-sm text-blue-500 mt-1 cursor-pointer hover:underline">
                                View conversion
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-5"></div>

                    {/* Second Entry - William */}
                    <div className="flex items-start gap-5">
                        <div className="w-[72px] h-[72px] rounded-full overflow-hidden ring-2 ring-gray-200 flex-shrink-0">
                            <Image
                                src="/faces/sabour.png"
                                alt="William"
                                width={72}
                                height={72}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-400 mb-1">12:07</p>
                            <p className="text-[15px] text-gray-800 leading-relaxed">
                                William found 325 more qualified leads from his discovery calls
                            </p>
                            <p className="text-sm text-blue-500 mt-1 cursor-pointer hover:underline">
                                View qualified leads
                            </p>
                        </div>
                    </div>
                </div>

                {/* Global Sessions Card - Bottom Left */}
                <div className="absolute bottom-0 left-0 w-[580px] bg-white rounded-[32px] shadow-[0_16px_50px_rgba(0,0,0,0.08)] p-8 z-10 border border-gray-100">
                    <h3 className="text-[28px] font-bold text-gray-900 mb-6">Global Sessions</h3>

                    {/* World Map SVG */}
                    <div className="w-full h-[200px]">
                        <svg viewBox="0 0 800 320" className="w-full h-full">
                            {/* North America */}
                            <path d="M80,60 Q120,40 180,50 Q240,60 280,90 Q300,120 290,160 Q280,200 240,220 Q200,240 150,230 Q100,220 70,180 Q50,140 60,100 Q65,75 80,60"
                                fill="#4f46e5" opacity="0.8" />
                            <path d="M50,140 Q60,160 80,180 Q100,200 120,220 Q100,250 80,260 Q60,250 45,220 Q35,180 50,140"
                                fill="#6366f1" opacity="0.7" />

                            {/* South America */}
                            <path d="M180,250 Q200,240 220,250 Q250,270 260,310 Q255,360 240,400 Q220,420 190,410 Q160,390 155,350 Q150,300 165,270 Q170,255 180,250"
                                fill="#4f46e5" opacity="0.85" />

                            {/* Europe */}
                            <path d="M380,50 Q420,45 460,55 Q480,70 475,100 Q465,120 430,125 Q400,120 385,100 Q370,75 380,50"
                                fill="#a5b4fc" opacity="0.6" />
                            <path d="M400,110 Q440,105 465,115 Q485,130 480,155 Q470,175 440,180 Q410,175 395,155 Q385,135 400,110"
                                fill="#818cf8" opacity="0.7" />

                            {/* Africa */}
                            <path d="M400,180 Q450,165 490,180 Q520,210 530,260 Q535,310 510,350 Q480,380 430,375 Q390,360 375,320 Q360,270 375,220 Q385,195 400,180"
                                fill="#818cf8" opacity="0.75" />

                            {/* Middle East / India */}
                            <path d="M500,120 Q550,105 600,125 Q640,150 650,200 Q645,250 610,280 Q570,300 530,290 Q500,270 490,230 Q480,175 500,120"
                                fill="#4f46e5" opacity="0.8" />

                            {/* Russia/Northern Asia */}
                            <path d="M470,40 Q550,30 650,35 Q720,45 750,70 Q770,100 760,130 Q740,150 680,155 Q600,160 520,145 Q470,130 460,100 Q455,65 470,40"
                                fill="#e0e7ff" opacity="0.5" />

                            {/* China / East Asia */}
                            <path d="M620,90 Q680,80 730,100 Q770,125 775,170 Q770,210 730,240 Q680,260 630,250 Q595,235 590,190 Q590,140 620,90"
                                fill="#818cf8" opacity="0.8" />

                            {/* Southeast Asia */}
                            <path d="M660,240 Q710,225 750,250 Q780,280 775,320 Q765,350 730,365 Q690,375 655,355 Q630,330 635,290 Q645,255 660,240"
                                fill="#c7d2fe" opacity="0.65" />

                            {/* Australia */}
                            <path d="M700,360 Q760,345 810,370 Q850,400 845,445 Q835,485 790,500 Q740,510 695,485 Q660,455 665,410 Q675,375 700,360"
                                fill="#4f46e5" opacity="0.85" />

                            {/* Japan */}
                            <path d="M765,90 Q790,85 805,100 Q815,120 810,145 Q800,165 780,170 Q760,165 755,145 Q750,115 765,90"
                                fill="#818cf8" opacity="0.8" />
                        </svg>
                    </div>
                </div>

                {/* Bella is calling Card - Right Side */}
                <div className="absolute top-[160px] right-0 w-[260px] bg-white rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.12)] p-8 z-20 border border-gray-100">
                    <div className="flex flex-col items-center">
                        <div className="w-[110px] h-[110px] rounded-full overflow-hidden ring-4 ring-gray-100 mb-6">
                            <Image
                                src="/faces/tina.png"
                                alt="Bella"
                                width={110}
                                height={110}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <p className="text-xl font-semibold text-gray-900 mb-6">Bella is calling</p>
                        <div className="flex gap-5">
                            <button className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-lg">
                                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                                </svg>
                            </button>
                            <button className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg">
                                <svg className="w-7 h-7 text-white transform rotate-135" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
