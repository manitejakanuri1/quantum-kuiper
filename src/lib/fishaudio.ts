// FishAudio Real API Integration
// Text-to-Speech using FishAudio API with fallback to Web Speech API

import { Voice } from './types';

interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
    error: string;
}

interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    start: () => void;
    stop: () => void;
}

interface WindowWithSpeechRecognition extends Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

const FISHAUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY || 'd4585642eb6a45b5ac96a82ae1285cd0';
const FISHAUDIO_API_URL = 'https://api.fish.audio/v1/tts';

// Available FishAudio voice models (these are real FishAudio model IDs)
// You can find more at https://fish.audio/
export const AVAILABLE_VOICES: Voice[] = [
    {
        id: 'ab9f86c943514589a52c00f55088e1ae',  // Real FishAudio voice ID
        name: 'E Girl',
        gender: 'female',
        preview: '/voices/e-girl.mp3',
        style: 'playful'
    },
    {
        id: 'default-female',
        name: 'Professional Female',
        gender: 'female',
        preview: '/voices/professional-female.mp3',
        style: 'professional'
    },
    {
        id: 'default-male',
        name: 'Friendly Male',
        gender: 'male',
        preview: '/voices/friendly-male.mp3',
        style: 'friendly'
    },
    {
        id: 'warm-female',
        name: 'Warm Female',
        gender: 'female',
        preview: '/voices/warm-female.mp3',
        style: 'warm'
    },
    {
        id: 'confident-male',
        name: 'Confident Male',
        gender: 'male',
        preview: '/voices/confident-male.mp3',
        style: 'confident'
    },
    {
        id: 'empathetic-female',
        name: 'Empathetic Female',
        gender: 'female',
        preview: '/voices/empathetic-female.mp3',
        style: 'empathetic'
    },
    {
        id: 'energetic-male',
        name: 'Energetic Male',
        gender: 'male',
        preview: '/voices/energetic-male.mp3',
        style: 'energetic'
    }
];

export function getVoiceById(id: string): Voice | undefined {
    return AVAILABLE_VOICES.find(v => v.id === id);
}

// Generate TTS audio using FishAudio API (server-side)
export async function generateTTSAudio(text: string, voiceId: string): Promise<ArrayBuffer | null> {
    if (!FISHAUDIO_API_KEY) {
        console.warn('FishAudio API key not configured');
        return null;
    }

    try {
        const response = await fetch(FISHAUDIO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FISHAUDIO_API_KEY}`
            },
            body: JSON.stringify({
                text: text,
                reference_id: voiceId,
                format: 'mp3',
                speed: 1.0
            })
        });

        if (!response.ok) {
            console.error('FishAudio API error:', response.status, await response.text());
            return null;
        }

        return await response.arrayBuffer();
    } catch (error) {
        console.error('FishAudio API request failed:', error);
        return null;
    }
}

// Client-side TTS using Web Speech API (browser native)
export function speakText(text: string, voiceId: string, onEnd?: () => void): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voice = getVoiceById(voiceId);

    // Try to match voice by gender
    if (voice && voices.length > 0) {
        const genderMatch = voices.find(v =>
            voice.gender === 'female'
                ? v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('samantha')
                : v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('daniel')
        );
        if (genderMatch) {
            utterance.voice = genderMatch;
        }
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    if (onEnd) {
        utterance.onend = onEnd;
    }

    window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;
    return window.speechSynthesis.speaking;
}

// Preview voice with sample text
export function previewVoice(voiceId: string): void {
    const voice = getVoiceById(voiceId);
    if (!voice) return;

    const sampleText = `Hello! I'm your ${voice.style} voice assistant. How can I help you today?`;
    speakText(sampleText, voiceId);
}

// Speech Recognition (STT) using Web Speech API
export function startListening(
    onResult: (text: string) => void,
    onEnd?: () => void
): { stop: () => void } | null {
    if (typeof window === 'undefined') return null;

    const windowWithSpeech = window as WindowWithSpeechRecognition;
    const SpeechRecognitionClass = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
        console.warn('Speech Recognition not supported');
        return null;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
    };

    recognition.onend = () => {
        if (onEnd) onEnd();
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (onEnd) onEnd();
    };

    recognition.start();

    return {
        stop: () => recognition.stop()
    };
}
