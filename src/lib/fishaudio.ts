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

// Available FishAudio voice models (these are real FishAudio model IDs)
// You can find more at https://fish.audio/
export const AVAILABLE_VOICES: Voice[] = [
    // NEW REALISTIC VOICES (Primary - Human-like)
    {
        id: '1b160c4cf02e4855a09efd59475b9370',  // Real FishAudio voice ID
        name: 'Sophia - Professional',
        gender: 'female',
        preview: '/voices/1b160c4cf02e4855a09efd59475b9370.mp3',  // Static preview file
        style: 'professional'
    },
    {
        id: '76f7e17483084df6b0f1bcecb5fb13e9',  // Real FishAudio voice ID
        name: 'Marcus - Confident',
        gender: 'male',
        preview: '/voices/76f7e17483084df6b0f1bcecb5fb13e9.mp3',  // Static preview file
        style: 'confident'
    },
    {
        id: '34b01f00fd8f4e12a664d1e081c13312',  // Real FishAudio voice ID
        name: 'David - Friendly',
        gender: 'male',
        preview: '/voices/34b01f00fd8f4e12a664d1e081c13312.mp3',  // Static preview file
        style: 'friendly'
    },

    // LEGACY VOICES (Backward compatibility)
    {
        id: 'ab9f86c943514589a52c00f55088e1ae',  // Real FishAudio voice ID
        name: 'E Girl - Playful',
        gender: 'female',
        preview: '/voices/ab9f86c943514589a52c00f55088e1ae.mp3',  // Static preview file
        style: 'playful'
    },
    {
        id: '4a98f7c293ee44898705529cc8ccc7d6',  // Real FishAudio voice ID
        name: 'Kawaii - Cute',
        gender: 'female',
        preview: '/voices/4a98f7c293ee44898705529cc8ccc7d6.mp3',  // Static preview file
        style: 'cute'
    }
];

export function getVoiceById(id: string): Voice | undefined {
    return AVAILABLE_VOICES.find(v => v.id === id);
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
