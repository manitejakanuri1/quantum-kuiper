'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload, Camera, Loader2, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { API_ROUTES } from '@/lib/api-routes';
import type { CustomAssetStatus } from '@/lib/types';

interface FaceUploadDialogProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (faceId: string, imageUrl: string) => void;
  currentImageUrl?: string | null;
  currentStatus?: CustomAssetStatus;
}

export function FaceUploadDialog({
  agentId,
  isOpen,
  onClose,
  onUploadComplete,
  currentImageUrl,
  currentStatus = 'none',
}: FaceUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CustomAssetStatus>(currentStatus);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for processing status
  useEffect(() => {
    if (status !== 'processing') return;

    const poll = async () => {
      try {
        const res = await fetch(API_ROUTES.agentFaceStatus(agentId));
        const data = await res.json();
        if (data.status === 'ready') {
          setStatus('ready');
          onUploadComplete(data.customFaceId, data.imageUrl);
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError('Face processing failed. Please try again.');
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // Continue polling on network error
      }
    };

    pollingRef.current = setInterval(poll, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status, agentId, onUploadComplete]);

  const handleFileSelect = useCallback((file: File) => {
    setError(null);

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Only JPG and PNG images are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB.');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!selectedFile || !consent) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('consent', 'true');

      const res = await fetch(API_ROUTES.agentFace(agentId), {
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
      if (data.imageUrl) setPreviewUrl(data.imageUrl);
    } catch {
      setError('Network error. Please try again.');
      setStatus('failed');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] rounded-2xl w-full max-w-md mx-4 border border-[#2A2A2A] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A2A]">
          <h2 className="text-lg font-semibold text-text-primary">Upload Custom Face</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Status: Processing */}
          {status === 'processing' && (
            <div className="text-center py-6 space-y-3">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto" />
              <p className="text-text-primary font-medium">Creating your avatar...</p>
              <p className="text-sm text-text-secondary">
                This can take up to 8 hours. Your agent will use the default face in the meantime.
              </p>
              {previewUrl && (
                <div className="w-24 h-24 mx-auto rounded-xl overflow-hidden ring-1 ring-[#2A2A2A] mt-4">
                  <Image src={previewUrl} alt="Uploaded face" width={96} height={96} className="object-cover w-full h-full" />
                </div>
              )}
            </div>
          )}

          {/* Status: Ready */}
          {status === 'ready' && (
            <div className="text-center py-6 space-y-3">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
              <p className="text-text-primary font-medium">Custom face is ready!</p>
              {previewUrl && (
                <div className="w-24 h-24 mx-auto rounded-xl overflow-hidden ring-2 ring-green-500/30 mt-4">
                  <Image src={previewUrl} alt="Custom face" width={96} height={96} className="object-cover w-full h-full" />
                </div>
              )}
            </div>
          )}

          {/* Upload form */}
          {(status === 'none' || status === 'failed') && (
            <>
              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#333] rounded-xl p-8 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
              >
                {previewUrl ? (
                  <div className="space-y-3">
                    <div className="w-32 h-32 mx-auto rounded-xl overflow-hidden ring-1 ring-[#2A2A2A]">
                      <Image src={previewUrl} alt="Preview" width={128} height={128} className="object-cover w-full h-full" unoptimized />
                    </div>
                    <p className="text-sm text-text-secondary">Click to change photo</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-full bg-[#2A2A2A] flex items-center justify-center">
                      <Camera className="w-6 h-6 text-text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm text-text-primary font-medium">Drop your photo here</p>
                      <p className="text-xs text-text-muted mt-1">or click to browse</p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </div>

              {/* Requirements */}
              <div className="text-xs text-text-muted space-y-1">
                <p className="font-medium text-text-secondary">Photo requirements:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Clear front-facing photo</li>
                  <li>Good lighting, neutral expression</li>
                  <li>JPG or PNG, max 5MB</li>
                  <li>No sunglasses, hat, or face covering</li>
                </ul>
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
                  I confirm this is my own face or I have permission to use it.
                  I understand this will create an AI avatar representation.
                </span>
              </label>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-[#2A2A2A]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-text-primary bg-[#2A2A2A] rounded-lg hover:bg-[#333] transition-colors"
          >
            {status === 'ready' || status === 'processing' ? 'Close' : 'Cancel'}
          </button>
          {(status === 'none' || status === 'failed') && (
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !consent || uploading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Face
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
