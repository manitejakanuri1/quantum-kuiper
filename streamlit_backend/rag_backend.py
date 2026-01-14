"""
Streamlit RAG Backend Service
Pure backend for RAG queries - no UI needed
Runs as a headless service that the main server.ts queries
"""

import streamlit as st
from supabase_client import get_supabase_client, find_best_answer
from fishaudio_client import generate_speech_sync

# This file provides the RAG query logic
# The actual API is exposed via api.py (FastAPI/uvicorn)

# For headless operation, we only need the API endpoints
# The Streamlit UI is optional and can be disabled

def query_rag(agent_id: str, user_query: str) -> dict:
    """
    Query the RAG system for the best matching answer.
    Returns the stored response verbatim (no LLM modification).
    """
    try:
        client = get_supabase_client()
        result = find_best_answer(client, agent_id, user_query)
        
        if result and result.get('spoken_response'):
            return {
                'text': result['spoken_response'],
                'question_matched': result.get('question'),
                'similarity': result.get('similarity', 0),
                'found': True
            }
        elif result and result.get('content'):
            return {
                'text': result['content'],
                'question_matched': result.get('question'),
                'similarity': result.get('similarity', 0),
                'found': True
            }
        else:
            return {
                'text': "I don't have specific information about that. How else can I help you?",
                'question_matched': None,
                'similarity': 0,
                'found': False
            }
    except Exception as e:
        print(f"[RAG] Error: {e}")
        return {
            'text': "I'm having trouble accessing the information. Please try again.",
            'question_matched': None,
            'similarity': 0,
            'found': False,
            'error': str(e)
        }


def generate_tts(text: str, voice_id: str = "8ef4a238714b45718ce04243307c57a7") -> bytes:
    """
    Generate speech audio from text using FishAudio.
    Returns audio bytes (MP3 format).
    """
    return generate_speech_sync(text, voice_id, format="mp3")


# Main entry point when run directly
if __name__ == "__main__":
    # For testing purposes
    print("RAG Backend Service")
    print("Run 'python -m uvicorn api:app --port 8000' for the API server")
