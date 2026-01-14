"""
FishAudio TTS Client
Handles text-to-speech conversion using FishAudio API
"""

import os
import httpx
from typing import Optional
from dotenv import load_dotenv

load_dotenv('../.env.local')


def get_fishaudio_api_key() -> str:
    """Get FishAudio API key from environment"""
    key = os.getenv('FISH_AUDIO_API_KEY') or os.getenv('FISHAUDIO_API_KEY')
    if not key:
        raise ValueError("FishAudio API key not found in environment")
    return key


async def generate_speech(
    text: str,
    voice_id: str = "8ef4a238714b45718ce04243307c57a7",
    format: str = "mp3"
) -> bytes:
    """Generate speech audio from text using FishAudio"""
    api_key = get_fishaudio_api_key()
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            'https://api.fish.audio/v1/tts',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}'
            },
            json={
                'text': text,
                'reference_id': voice_id,
                'format': format
            },
            timeout=30.0
        )
        
        if response.status_code != 200:
            raise Exception(f"FishAudio API error: {response.status_code} - {response.text}")
        
        return response.content


def generate_speech_sync(
    text: str,
    voice_id: str = "8ef4a238714b45718ce04243307c57a7",
    format: str = "mp3"
) -> bytes:
    """Synchronous version of generate_speech"""
    api_key = get_fishaudio_api_key()
    
    response = httpx.post(
        'https://api.fish.audio/v1/tts',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        },
        json={
            'text': text,
            'reference_id': voice_id,
            'format': format
        },
        timeout=30.0
    )
    
    if response.status_code != 200:
        raise Exception(f"FishAudio API error: {response.status_code} - {response.text}")
    
    return response.content


# Available voices (from the project configuration)
AVAILABLE_VOICES = [
    {"id": "8ef4a238714b45718ce04243307c57a7", "name": "E Girl", "gender": "female"},
    {"id": "default-female", "name": "Professional Female", "gender": "female"},
    {"id": "default-male", "name": "Friendly Male", "gender": "male"},
    {"id": "warm-female", "name": "Warm Female", "gender": "female"},
    {"id": "confident-male", "name": "Confident Male", "gender": "male"},
]
