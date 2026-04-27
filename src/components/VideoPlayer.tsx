'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

function isGoogleDriveEmbed(url: string | undefined | null): boolean {
  return typeof url === 'string' && url.includes('drive.google.com');
}

/** Extract Google Drive file ID from various URL formats */
function extractDriveFileId(url: string): string | null {
  // Format: /file/d/{fileId}/...
  const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];
  
  // Format: ?id={fileId}
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  
  // Format: /open?id={fileId}
  const match3 = url.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
  if (match3) return match3[1];
  
  return null;
}

/** Convert Drive file ID to proxied video URL (bypasses CORS) */
function getDriveDirectUrl(fileId: string): string {
  // Use our proxy endpoint to stream the video
  return `/api/proxy-video?fileId=${fileId}`;
}

export interface FrameCapturePayload {
  timestamp_seconds: number;
  imageDataUrl: string;
}

interface VideoPlayerProps {
  embedUrl: string | undefined | null;
  title: string;
  onTimestampCapture?: (timestamp: number) => void;
  onCaptureRequest?: () => void;
  onFrameCapture?: (payload: FrameCapturePayload) => void;
  /** Auto-capture frame when video is paused (works in direct mode) */
  autoCaptureOnPause?: boolean;
}

export function VideoPlayer({
  embedUrl,
  title,
  onTimestampCapture,
  onCaptureRequest,
  onFrameCapture,
  autoCaptureOnPause = false,
}: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [showCaptureIndicator, setShowCaptureIndicator] = useState(false);
  
  const isGoogleDrive = isGoogleDriveEmbed(embedUrl);
  const driveFileId = isGoogleDrive && typeof embedUrl === 'string' ? extractDriveFileId(embedUrl) : null;
  
  // Prefer direct/proxy mode for Google Drive so playback works even when Drive is still "processing" the file
  const [useDirectMode, setUseDirectMode] = useState(!!driveFileId);
  const [directModeError, setDirectModeError] = useState(false);
  const [directModeLoading, setDirectModeLoading] = useState(false);
  
  // Determine if we should use native video element
  const useNativeVideo = !isGoogleDrive || (useDirectMode && !directModeError);

  // Iframe: listen for postMessage time (Google Drive)
  useEffect(() => {
    if (useNativeVideo) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        if (event.data && typeof event.data === 'object') {
          if ('currentTime' in event.data && typeof event.data.currentTime === 'number') {
            const time = Math.floor(event.data.currentTime);
            setCurrentTime(time);
            onTimestampCapture?.(time);
            return;
          }
          if ('data' in event.data && event.data.data && typeof event.data.data === 'object' && 'currentTime' in event.data.data) {
            const time = Math.floor(event.data.data.currentTime);
            setCurrentTime(time);
            onTimestampCapture?.(time);
            return;
          }
        }
        if (typeof event.data === 'string') {
          const timeMatch = event.data.match(/currentTime[":\s]*(\d+)/i);
          if (timeMatch) {
            const time = parseInt(timeMatch[1], 10);
            setCurrentTime(time);
            onTimestampCapture?.(time);
          }
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('message', handleMessage);
    const requestTime = () => {
      try {
        iframeRef.current?.contentWindow?.postMessage({ action: 'getCurrentTime' }, '*');
        iframeRef.current?.contentWindow?.postMessage('getCurrentTime', '*');
      } catch {
        // CORS expected
      }
    };
    const interval = setInterval(requestTime, 2000);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, [useNativeVideo, onTimestampCapture]);

  // Native video: sync currentTime for timestamp capture
  useEffect(() => {
    if (!useNativeVideo) return;

    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = Math.floor(video.currentTime);
      setCurrentTime(time);
    };
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [useNativeVideo]);

  // Capture time only (iframe or manual)
  useEffect(() => {
    if (!onCaptureRequest) return;

    const handleCapture = () => {
      if (currentTime !== null && onTimestampCapture) {
        onTimestampCapture(currentTime);
      } else if (useNativeVideo && videoRef.current) {
        const t = Math.floor(videoRef.current.currentTime);
        setCurrentTime(t);
        onTimestampCapture?.(t);
      } else if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.postMessage({ action: 'getCurrentTime' }, '*');
        } catch {
          // CORS
        }
      }
    };

    (window as Window & { __captureVideoTime?: () => void }).__captureVideoTime = handleCapture;
    return () => {
      delete (window as Window & { __captureVideoTime?: () => void }).__captureVideoTime;
    };
  }, [currentTime, onTimestampCapture, onCaptureRequest, useNativeVideo]);

  // Capture frame + timestamp (native video only; iframe cannot access pixels)
  useEffect(() => {
    if (!useNativeVideo || !onFrameCapture) return;

    const captureFrame = (): boolean => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return false;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      ctx.drawImage(video, 0, 0);
      const timestamp_seconds = Math.floor(video.currentTime);
      try {
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onFrameCapture({ timestamp_seconds, imageDataUrl });
        return true;
      } catch {
        // Tainted canvas (cross-origin video without CORS). Send timestamp only; UI can use manual screenshot.
        onFrameCapture({ timestamp_seconds, imageDataUrl: '' });
        return true;
      }
    };

    (window as Window & { __captureFrame?: () => boolean }).__captureFrame = captureFrame;
    return () => {
      delete (window as Window & { __captureFrame?: () => boolean }).__captureFrame;
    };
  }, [useNativeVideo, onFrameCapture]);

  // Auto-capture frame when video is paused (native video only)
  useEffect(() => {
    if (!useNativeVideo || !autoCaptureOnPause || !onFrameCapture) return;

    const video = videoRef.current;
    if (!video) return;

    const handlePause = () => {
      // Small delay to ensure video has fully paused
      setTimeout(() => {
        if (video.paused && video.readyState >= 2) {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.drawImage(video, 0, 0);
          const timestamp_seconds = Math.floor(video.currentTime);
          try {
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            onFrameCapture({ timestamp_seconds, imageDataUrl });
          } catch {
            onFrameCapture({ timestamp_seconds, imageDataUrl: '' });
          }
          setShowCaptureIndicator(true);
          setTimeout(() => setShowCaptureIndicator(false), 1500);
        }
      }, 100);
    };

    video.addEventListener('pause', handlePause);
    return () => video.removeEventListener('pause', handlePause);
  }, [useNativeVideo, autoCaptureOnPause, onFrameCapture]);

  // Handle direct mode video errors
  const handleVideoError = useCallback(() => {
    if (isGoogleDrive && useDirectMode) {
      setDirectModeError(true);
      setDirectModeLoading(false);
    }
  }, [isGoogleDrive, useDirectMode]);

  const handleVideoCanPlay = useCallback(() => {
    setDirectModeLoading(false);
    setDirectModeError(false);
  }, []);

  // Get the video source URL
  const videoSrc = isGoogleDrive && useDirectMode && driveFileId
    ? getDriveDirectUrl(driveFileId)
    : (embedUrl ?? undefined);

  // 9:16 portrait container for mobile/social format videos
  const containerClass = 'relative w-full aspect-[9/16] max-h-[min(85vh,800px)]';

  // Render native video (for non-Drive URLs or Drive in direct mode)
  if (useNativeVideo) {
    return (
      <div className={containerClass}>
          <video
            ref={videoRef}
            src={videoSrc}
            crossOrigin="anonymous"
            title={title}
            className="absolute inset-0 w-full h-full rounded-lg bg-black object-contain"
            controls
            playsInline
            onError={handleVideoError}
            onCanPlay={handleVideoCanPlay}
          />
          
          {/* Loading indicator for direct mode */}
          {directModeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-center">
                <svg className="animate-spin h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Loading direct video...</span>
              </div>
            </div>
          )}
          
          {/* Auto-capture indicator */}
          {showCaptureIndicator && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/70 text-white px-4 py-2 rounded-lg flex items-center gap-2 animate-pulse">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium">Frame Captured</span>
              </div>
            </div>
          )}
          
      </div>
    );
  }

  // Render iframe embed (for Google Drive when direct mode is off or failed)
  return (
    <div className={containerClass}>
      <iframe
        ref={iframeRef}
        src={embedUrl ?? undefined}
        title={title}
        className="absolute inset-0 w-full h-full rounded-lg"
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    </div>
  );
}
