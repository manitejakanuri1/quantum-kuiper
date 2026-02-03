// Simli API Integration for Real-Time Avatar Video
// Lip-synced AI avatars with real-time face rendering

import { Face } from './types';

const SIMLI_API_KEY = process.env.NEXT_PUBLIC_SIMLI_API_KEY;

if (typeof window === 'undefined' && !SIMLI_API_KEY) {
    console.error('❌ NEXT_PUBLIC_SIMLI_API_KEY environment variable not set!');
}
const SIMLI_API_URL = 'https://api.simli.ai/audioToVideoStream';

// Available avatar faces from Simli (Real Face IDs)
export const AVAILABLE_FACES: Face[] = [
    {
        id: 'cace3ef7-a4c4-425d-a8cf-a5358eb0c427',
        name: 'Tina',
        thumbnail: '/faces/tina.png',
        videoIdle: '/faces/tina-idle.mp4',
        gender: 'female',
        ethnicity: 'asian'
    },
    {
        id: '7e74d6e7-d559-4394-bd56-4923a3ab75ad',
        name: 'Sabour',
        thumbnail: '/faces/sabour.png',
        videoIdle: '/faces/sabour-idle.mp4',
        gender: 'male',
        ethnicity: 'indian'
    },
    {
        id: 'f0ba4efe-7946-45de-9955-c04a04c367b9',
        name: 'Doctor',
        thumbnail: '/faces/doctor.png',
        videoIdle: '/faces/doctor-idle.mp4',
        gender: 'female',
        ethnicity: 'caucasian'
    },
    {
        id: '804c347a-26c9-4dcf-bb49-13df4bed61e8',
        name: 'Mark',
        thumbnail: '/faces/mark.png',
        videoIdle: '/faces/mark-idle.mp4',
        gender: 'male',
        ethnicity: 'african'
    }
];

export function getFaceById(id: string): Face | undefined {
    return AVAILABLE_FACES.find(f => f.id === id || f.name.toLowerCase() === id.toLowerCase());
}

// Start a Simli avatar session (server-side)
export async function startSimliSession(faceId: string): Promise<{
    sessionId: string;
    iceServers: RTCIceServer[];
} | null> {
    if (!SIMLI_API_KEY) {
        console.warn('Simli API key not configured');
        return null;
    }

    try {
        const response = await fetch('https://api.simli.ai/startAudioToVideoSession', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Simli-Api-Key': SIMLI_API_KEY
            },
            body: JSON.stringify({
                faceId: faceId,
                isJPG: false,
                syncAudio: true
            })
        });

        if (!response.ok) {
            console.error('Simli API error:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Simli API request failed:', error);
        return null;
    }
}

// Send audio chunk to Simli for lip-sync
export async function sendAudioToSimli(
    sessionId: string,
    audioData: ArrayBuffer
): Promise<ArrayBuffer | null> {
    if (!SIMLI_API_KEY) return null;

    try {
        const response = await fetch(SIMLI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'X-Simli-Api-Key': SIMLI_API_KEY,
                'X-Session-Id': sessionId
            },
            body: audioData
        });

        if (!response.ok) {
            console.error('Simli audio error:', response.status);
            return null;
        }

        return await response.arrayBuffer();
    } catch (error) {
        console.error('Simli audio request failed:', error);
        return null;
    }
}

// Simple face animation fallback (returns animated SVG data)
export function getAnimatedFaceData(faceId: string, state: 'idle' | 'speaking' | 'listening'): {
    expression: string;
    mouthOpen: number;
    eyeBlink: boolean;
} {


    switch (state) {
        case 'speaking':
            return {
                expression: 'speaking',
                mouthOpen: Math.random() * 0.5 + 0.3, // Random mouth movement
                eyeBlink: Math.random() > 0.95
            };
        case 'listening':
            return {
                expression: 'attentive',
                mouthOpen: 0.1,
                eyeBlink: Math.random() > 0.9
            };
        case 'idle':
        default:
            return {
                expression: 'neutral',
                mouthOpen: 0,
                eyeBlink: Math.random() > 0.97
            };
    }
}

// Check if Simli is configured
export function isSimliConfigured(): boolean {
    return !!SIMLI_API_KEY;
}
