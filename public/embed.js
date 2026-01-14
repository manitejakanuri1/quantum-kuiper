// VoiceAgent Embed Script
// Real-time voice agent with Web Speech API for TTS and Speech Recognition

(function () {
    'use strict';

    // Get configuration from script tag
    const currentScript = document.currentScript;
    const agentId = currentScript?.getAttribute('data-agent-id');
    const position = currentScript?.getAttribute('data-position') || 'bottom-right';
    const autoGreet = currentScript?.getAttribute('data-auto-greet') === 'true';
    const apiBase = currentScript?.getAttribute('data-api-base') || window.location.origin;

    if (!agentId) {
        console.error('VoiceAgent: Missing data-agent-id attribute');
        return;
    }

    // State
    let isOpen = false;
    let isListening = false;
    let isSpeaking = false;
    let recognition = null;

    // Create widget container
    const container = document.createElement('div');
    container.id = 'voiceagent-widget';
    container.innerHTML = `
    <style>
      #voiceagent-widget {
        --va-primary: #8b5cf6;
        --va-secondary: #06b6d4;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      #voiceagent-bubble {
        position: fixed;
        ${position.includes('bottom') ? 'bottom: 24px;' : 'top: 24px;'}
        ${position.includes('right') ? 'right: 24px;' : 'left: 24px;'}
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--va-primary), var(--va-secondary));
        box-shadow: 0 8px 32px rgba(139, 92, 246, 0.3);
        cursor: pointer;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        animation: voiceagent-pulse 2s infinite;
      }
      
      #voiceagent-bubble:hover {
        transform: scale(1.1);
        box-shadow: 0 12px 40px rgba(139, 92, 246, 0.4);
      }
      
      #voiceagent-bubble-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      
      #voiceagent-bubble-status {
        position: absolute;
        bottom: 4px;
        right: 4px;
        width: 14px;
        height: 14px;
        background: #22c55e;
        border: 3px solid white;
        border-radius: 50%;
        animation: voiceagent-pulse 1.5s infinite;
      }
      
      #voiceagent-modal {
        position: fixed;
        ${position.includes('bottom') ? 'bottom: 104px;' : 'top: 104px;'}
        ${position.includes('right') ? 'right: 24px;' : 'left: 24px;'}
        width: 380px;
        height: 520px;
        background: linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%);
        border-radius: 24px;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        z-index: 999998;
        display: none;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      #voiceagent-modal.active {
        display: flex;
        animation: voiceagent-slideUp 0.3s ease;
      }
      
      #voiceagent-modal-header {
        padding: 16px 20px;
        background: rgba(255, 255, 255, 0.05);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      #voiceagent-modal-header h3 {
        color: white;
        font-size: 16px;
        font-weight: 600;
        margin: 0;
      }
      
      #voiceagent-modal-close {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }
      
      #voiceagent-modal-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      #voiceagent-avatar-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        background: radial-gradient(circle at center, rgba(139, 92, 246, 0.1) 0%, transparent 70%);
      }
      
      #voiceagent-avatar {
        width: 180px;
        height: 180px;
      }
      
      #voiceagent-avatar.speaking .mouth {
        animation: voiceagent-talk 0.3s infinite;
      }
      
      #voiceagent-status-text {
        text-align: center;
        color: #a1a1aa;
        font-size: 14px;
        padding: 8px 20px;
      }
      
      #voiceagent-controls {
        padding: 20px;
        background: rgba(0, 0, 0, 0.3);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      #voiceagent-mic-btn {
        width: 100%;
        padding: 16px 24px;
        border-radius: 16px;
        border: none;
        background: linear-gradient(135deg, var(--va-primary), var(--va-secondary));
        color: white;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.3s ease;
      }
      
      #voiceagent-mic-btn:hover {
        transform: scale(1.02);
        box-shadow: 0 8px 24px rgba(139, 92, 246, 0.3);
      }
      
      #voiceagent-mic-btn.listening {
        background: linear-gradient(135deg, #ef4444, #f97316);
        animation: voiceagent-pulse 1s infinite;
      }
      
      @keyframes voiceagent-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }
      
      @keyframes voiceagent-slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes voiceagent-talk {
        0%, 100% { transform: scaleY(1); }
        50% { transform: scaleY(1.5); }
      }
      
      @keyframes voiceagent-breathe {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }
      
      #voiceagent-wave-bars {
        display: flex;
        gap: 3px;
        height: 20px;
        align-items: center;
      }
      
      .voiceagent-wave-bar {
        width: 4px;
        background: rgba(255,255,255,0.5);
        border-radius: 2px;
        animation: voiceagent-wave 0.5s ease-in-out infinite;
      }
      
      @keyframes voiceagent-wave {
        0%, 100% { height: 8px; }
        50% { height: 20px; }
      }
    </style>
    
    <div id="voiceagent-bubble">
      <div id="voiceagent-bubble-avatar">
        <svg viewBox="0 0 100 100" width="48" height="48">
          <ellipse cx="50" cy="45" rx="30" ry="35" fill="#fcd5b8"/>
          <path d="M 20 35 Q 20 10, 50 10 Q 80 10, 80 35 Q 75 25, 50 25 Q 25 25, 20 35" fill="#3d2314"/>
          <ellipse cx="38" cy="40" rx="5" ry="4" fill="white"/>
          <ellipse cx="62" cy="40" rx="5" ry="4" fill="white"/>
          <circle cx="38" cy="40" r="2.5" fill="#1a1a1a"/>
          <circle cx="62" cy="40" r="2.5" fill="#1a1a1a"/>
          <path d="M 43 58 Q 50 62, 57 58" stroke="#c47c7c" stroke-width="2" fill="none"/>
        </svg>
      </div>
      <div id="voiceagent-bubble-status"></div>
    </div>
    
    <div id="voiceagent-modal">
      <div id="voiceagent-modal-header">
        <h3>Voice Assistant</h3>
        <button id="voiceagent-modal-close">×</button>
      </div>
      
      <div id="voiceagent-avatar-container">
        <svg id="voiceagent-avatar" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#a78bfa"/>
              <stop offset="100%" style="stop-color:#67e8f9"/>
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill="url(#bgGrad)" opacity="0.2"/>
          <ellipse cx="50" cy="45" rx="30" ry="35" fill="#fcd5b8"/>
          <path d="M 20 35 Q 20 10, 50 10 Q 80 10, 80 35 Q 75 25, 50 25 Q 25 25, 20 35" fill="#3d2314"/>
          <ellipse cx="38" cy="40" rx="5" ry="4" fill="white"/>
          <ellipse cx="62" cy="40" rx="5" ry="4" fill="white"/>
          <circle cx="38" cy="40" r="2.5" fill="#1a1a1a"/>
          <circle cx="62" cy="40" r="2.5" fill="#1a1a1a"/>
          <path d="M 32 33 Q 38 30, 44 33" stroke="#4a3728" stroke-width="1.5" fill="none"/>
          <path d="M 56 33 Q 62 30, 68 33" stroke="#4a3728" stroke-width="1.5" fill="none"/>
          <ellipse cx="30" cy="52" rx="6" ry="3" fill="#ffb6c1" opacity="0.4"/>
          <ellipse cx="70" cy="52" rx="6" ry="3" fill="#ffb6c1" opacity="0.4"/>
          <path class="mouth" d="M 43 58 Q 50 62, 57 58" stroke="#c47c7c" stroke-width="2.5" fill="none" transform-origin="50px 58px"/>
        </svg>
      </div>
      
      <div id="voiceagent-status-text">Click the button to start talking</div>
      
      <div id="voiceagent-controls">
        <button id="voiceagent-mic-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          Click to Talk
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(container);

    // Elements
    const bubble = document.getElementById('voiceagent-bubble');
    const modal = document.getElementById('voiceagent-modal');
    const closeBtn = document.getElementById('voiceagent-modal-close');
    const micBtn = document.getElementById('voiceagent-mic-btn');
    const statusText = document.getElementById('voiceagent-status-text');
    const avatar = document.getElementById('voiceagent-avatar');

    // Speech Synthesis (TTS)
    function speak(text, onEnd) {
        if (!window.speechSynthesis) {
            console.warn('Speech synthesis not supported');
            if (onEnd) onEnd();
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Try to get a good voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v =>
            v.name.includes('Samantha') ||
            v.name.includes('Google') ||
            v.lang.startsWith('en')
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        isSpeaking = true;
        avatar.classList.add('speaking');
        if (statusText) statusText.textContent = 'Speaking...';

        utterance.onend = () => {
            isSpeaking = false;
            avatar.classList.remove('speaking');
            if (statusText) statusText.textContent = 'Ready to help';
            if (onEnd) onEnd();
        };

        utterance.onerror = () => {
            isSpeaking = false;
            avatar.classList.remove('speaking');
            if (onEnd) onEnd();
        };

        window.speechSynthesis.speak(utterance);
    }

    // Speech Recognition (STT)
    function startListening() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            if (statusText) statusText.textContent = 'Speech recognition not supported in this browser';
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            if (micBtn) {
                micBtn.classList.add('listening');
                micBtn.innerHTML = `
          <div id="voiceagent-wave-bars">
            <div class="voiceagent-wave-bar" style="animation-delay: 0s"></div>
            <div class="voiceagent-wave-bar" style="animation-delay: 0.1s"></div>
            <div class="voiceagent-wave-bar" style="animation-delay: 0.2s"></div>
            <div class="voiceagent-wave-bar" style="animation-delay: 0.1s"></div>
            <div class="voiceagent-wave-bar" style="animation-delay: 0s"></div>
          </div>
          Listening...
        `;
            }
            if (statusText) statusText.textContent = 'Listening...';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (statusText) statusText.textContent = `You said: "${transcript}"`;

            // Process the query
            processQuery(transcript);
        };

        recognition.onend = () => {
            isListening = false;
            resetMicButton();
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isListening = false;
            resetMicButton();
            if (statusText) statusText.textContent = 'Error: ' + event.error;
        };

        recognition.start();
    }

    function stopListening() {
        if (recognition) {
            recognition.stop();
            recognition = null;
        }
        isListening = false;
        resetMicButton();
    }

    function resetMicButton() {
        if (micBtn) {
            micBtn.classList.remove('listening');
            micBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        Click to Talk
      `;
        }
    }

    // Process query and get response (calls backend or uses fallback)
    async function processQuery(query) {
        if (statusText) statusText.textContent = 'Thinking...';

        try {
            // Try to call the backend API
            const response = await fetch(`${apiBase}/api/agent/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: agentId,
                    action: 'message',
                    text: query
                })
            });

            if (response.ok) {
                const data = await response.json();
                speak(data.response || data.text || "I'm here to help! How can I assist you?");
            } else {
                // Fallback response
                speak(getLocalResponse(query));
            }
        } catch (error) {
            console.log('API not available, using local response');
            speak(getLocalResponse(query));
        }
    }

    // Local fallback responses
    function getLocalResponse(query) {
        const q = query.toLowerCase();

        if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
            return "Hello! How can I help you today?";
        }
        if (q.includes('hour') || q.includes('open') || q.includes('time')) {
            return "We're open Monday through Friday, 9 AM to 5 PM. Is there anything else I can help with?";
        }
        if (q.includes('price') || q.includes('cost') || q.includes('how much')) {
            return "Our pricing varies by service. Would you like me to connect you with our team for a free estimate?";
        }
        if (q.includes('help') || q.includes('service')) {
            return "We offer a wide range of services. What specifically are you looking for help with?";
        }
        if (q.includes('thank')) {
            return "You're welcome! Is there anything else I can help you with?";
        }
        if (q.includes('bye') || q.includes('goodbye')) {
            return "Goodbye! Have a great day!";
        }

        return "I'd be happy to help with that. Could you tell me more about what you need?";
    }

    // Event Listeners
    if (bubble) {
        bubble.addEventListener('click', () => {
            isOpen = !isOpen;
            if (modal) modal.classList.toggle('active', isOpen);
            if (isOpen && autoGreet) {
                setTimeout(() => {
                    speak("Hi! How can I help you today?");
                }, 500);
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            isOpen = false;
            if (modal) modal.classList.remove('active');
            stopListening();
            window.speechSynthesis?.cancel();
        });
    }

    if (micBtn) {
        micBtn.addEventListener('click', () => {
            if (isSpeaking) {
                window.speechSynthesis?.cancel();
                isSpeaking = false;
                avatar.classList.remove('speaking');
            }

            if (isListening) {
                stopListening();
            } else {
                startListening();
            }
        });
    }

    // Auto-greet on load
    if (autoGreet) {
        setTimeout(() => {
            isOpen = true;
            if (modal) modal.classList.add('active');
            setTimeout(() => {
                speak("Hi! How can I help you today?");
            }, 500);
        }, 2000);
    }

    // Load voices
    if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
        };
    }

    console.log('VoiceAgent widget loaded for agent:', agentId);
})();
