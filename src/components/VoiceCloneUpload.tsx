'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Upload, Play, Pause, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { API_ROUTES } from '@/lib/api-routes';
import type { CustomAssetStatus } from '@/lib/types';

interface VoiceCloneUploadProps {
  agentId: string;
  currentStatus?: CustomAssetStatus;
  currentVoiceName?: string | null;
  onCloneComplete: (voiceId: string, voiceName: string) => void;
  onCancel: () => void;
}

type SubTab = 'record' | 'upload';

const SAMPLE_TEXT = `Welcome to our business. We offer a wide range of products and services designed to help you succeed. Whether you're looking for web design, marketing solutions, or customer support, our team is here to assist you every step of the way. We believe in building lasting relationships with our customers and delivering quality results.`;

export function VoiceCloneUpload({
  agentId,
  currentStatus = 'none',
  currentVoiceName,
  onCloneComplete,
  onCancel,
}: VoiceCloneUploadProps) {
  const [subTab, setSubTab] = useState<SubTab>('record');
  const [voiceName, setVoiceName] = useState(currentVoiceName || '');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CustomAssetStatus>(currentStatus);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Polling for processing status
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status !== 'processing') return;

    const poll = async () => {
      try {
        const res = await fetch(API_ROUTES.agentVoiceStatus(agentId));
        const data = await res.json();
        if (data.status === 'ready') {
          setStatus('ready');
          onCloneComplete(data.customVoiceId, data.voiceName);
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError('Voice clone failed. Please try again.');
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // Continue polling
      }
    };

    pollingRef.current = setInterval(poll, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status, agentId, onCloneComplete]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordedBlob(null);

      timerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch {
      setError('Could not access microphone. Please grant permission and try again.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const playPreview = useCallback(() => {
    const blob = recordedBlob || (selectedFile ? selectedFile : null);
    if (!blob) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  }, [recordedBlob, selectedFile, isPlaying]);

  const handleSubmit = async () => {
    const audioSource = subTab === 'record' ? recordedBlob : selectedFile;
    if (!audioSource || !consent || !voiceName.trim()) return;

    if (subTab === 'record' && recordingDuration < 15) {
      setError('Please record at least 15 seconds of audio.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioSource, subTab === 'record' ? 'recording.webm' : (selectedFile?.name || 'audio.wav'));
      formData.append('consent', 'true');
      formData.append('voiceName', voiceName.trim());

      const res = await fetch(API_ROUTES.agentVoice(agentId), {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Upload failed');
        setStatus('failed');
        return;
      }

      setStatus('processing');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Processing/Ready states
  if (status === 'processing') {
    return (
      <div className="text-center py-8 space-y-3">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
        <p className="text-text-primary font-medium">Creating your voice clone...</p>
        <p className="text-sm text-text-secondary">This usually takes a few minutes.</p>
        {voiceName && <p className="text-xs text-text-muted">Voice: {voiceName}</p>}
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="text-center py-8 space-y-3">
        <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
        <p className="text-text-primary font-medium">Voice clone ready!</p>
        {voiceName && <p className="text-sm text-text-secondary">{voiceName}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sub-tabs: Record vs Upload */}
      <div className="flex gap-1 bg-[#1A1A1A] rounded-lg p-1">
        <button
          onClick={() => setSubTab('record')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            subTab === 'record' ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Mic className="w-4 h-4 inline mr-1.5" />
          Record
        </button>
        <button
          onClick={() => setSubTab('upload')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            subTab === 'upload' ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Upload className="w-4 h-4 inline mr-1.5" />
          Upload File
        </button>
      </div>

      {/* Record tab */}
      {subTab === 'record' && (
        <div className="space-y-4">
          <div className="bg-[#1A1A1A] rounded-xl p-4">
            <p className="text-xs text-text-secondary mb-3">Read the following text clearly:</p>
            <p className="text-sm text-text-primary leading-relaxed italic">&ldquo;{SAMPLE_TEXT}&rdquo;</p>
          </div>

          <div className="text-center space-y-3">
            <p className="text-2xl font-mono text-text-primary">{formatTime(recordingDuration)}</p>

            {/* Recording progress bar */}
            {isRecording && (
              <div className="w-full h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-1000"
                  style={{ width: `${Math.min((recordingDuration / 45) * 100, 100)}%` }}
                />
              </div>
            )}

            <div className="flex justify-center gap-3">
              {!isRecording && !recordedBlob && (
                <button
                  onClick={startRecording}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium flex items-center gap-2 transition-colors"
                >
                  <Mic className="w-5 h-5" />
                  Start Recording
                </button>
              )}

              {isRecording && (
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-[#2A2A2A] hover:bg-[#333] text-text-primary rounded-full font-medium flex items-center gap-2 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              )}

              {recordedBlob && !isRecording && (
                <>
                  <button
                    onClick={playPreview}
                    className="px-4 py-2.5 bg-[#2A2A2A] hover:bg-[#333] text-text-primary rounded-lg font-medium flex items-center gap-2 text-sm transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? 'Pause' : 'Preview'}
                  </button>
                  <button
                    onClick={() => { setRecordedBlob(null); setRecordingDuration(0); }}
                    className="px-4 py-2.5 bg-[#2A2A2A] hover:bg-[#333] text-text-primary rounded-lg font-medium text-sm transition-colors"
                  >
                    Re-record
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="text-xs text-text-muted space-y-1">
            <p className="font-medium text-text-secondary">Tips:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Use a quiet room with no echo</li>
              <li>Speak naturally at normal pace</li>
              <li>Record at least 45 seconds for best quality</li>
            </ul>
          </div>
        </div>
      )}

      {/* Upload tab */}
      {subTab === 'upload' && (
        <div className="space-y-4">
          <div
            onClick={() => document.getElementById('voice-file-input')?.click()}
            className="border-2 border-dashed border-[#333] rounded-xl p-8 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
          >
            {selectedFile ? (
              <div className="space-y-2">
                <p className="text-sm text-text-primary font-medium">{selectedFile.name}</p>
                <p className="text-xs text-text-secondary">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                <button
                  onClick={(e) => { e.stopPropagation(); playPreview(); }}
                  className="text-xs text-orange-400 hover:text-orange-300"
                >
                  {isPlaying ? 'Pause preview' : 'Play preview'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-text-secondary mx-auto" />
                <p className="text-sm text-text-primary">Drop audio file here</p>
                <p className="text-xs text-text-muted">MP3, WAV, or M4A — max 10MB</p>
              </div>
            )}
            <input
              id="voice-file-input"
              type="file"
              accept="audio/wav,audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,.wav,.mp3,.m4a"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setSelectedFile(file); setError(null); }
              }}
            />
          </div>

          <div className="text-xs text-text-muted space-y-1">
            <p className="font-medium text-text-secondary">Requirements:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>45-60 seconds of clear speech</li>
              <li>Single speaker only</li>
              <li>Minimal background noise</li>
            </ul>
          </div>
        </div>
      )}

      {/* Voice name */}
      <div>
        <label className="text-sm text-text-secondary block mb-1.5">Voice name</label>
        <input
          type="text"
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          placeholder="e.g., My Voice"
          className="w-full px-3 py-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-text-primary text-sm focus:outline-none focus:border-orange-500/50"
          maxLength={100}
        />
      </div>

      {/* Consent */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-border-default bg-[#2A2A2A] text-orange-500 focus:ring-orange-500"
        />
        <span className="text-xs text-text-secondary leading-relaxed">
          I confirm this is my own voice or I have permission to use it.
          I understand this will create an AI voice clone.
        </span>
      </label>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-text-primary bg-[#2A2A2A] rounded-lg hover:bg-[#333] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={
            uploading || !consent || !voiceName.trim() ||
            (subTab === 'record' ? !recordedBlob : !selectedFile)
          }
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Voice Clone'
          )}
        </button>
      </div>
    </div>
  );
}
