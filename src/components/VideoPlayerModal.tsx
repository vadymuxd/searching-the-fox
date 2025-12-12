'use client';

import { Modal } from '@mantine/core';
import { useEffect, useRef, useCallback } from 'react';

interface VideoPlayerModalProps {
  opened: boolean;
  onClose: () => void;
  videoUrl: string;
}

export function VideoPlayerModal({ opened, onClose, videoUrl }: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleLoadedMetadata = useCallback(() => {
    if (!opened || !videoRef.current) return;

    const video = videoRef.current;

    type FullscreenVideoElement = HTMLVideoElement & {
      webkitEnterFullscreen?: () => Promise<void> | void;
      webkitRequestFullscreen?: () => Promise<void> | void;
      mozRequestFullScreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };

    // Start playback as soon as the video is ready
    const playPromise = video.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(() => {
        // Autoplay might be blocked; user can still tap play.
      });
    }

    // Request fullscreen for immersive view (best-effort)
    const fullscreenVideo = video as FullscreenVideoElement;
    const requestFullscreen =
      video.requestFullscreen?.bind(video) ||
      fullscreenVideo.webkitEnterFullscreen?.bind(fullscreenVideo) ||
      fullscreenVideo.webkitRequestFullscreen?.bind(fullscreenVideo) ||
      fullscreenVideo.mozRequestFullScreen?.bind(fullscreenVideo) ||
      fullscreenVideo.msRequestFullscreen?.bind(fullscreenVideo);

    if (requestFullscreen) {
      try {
        const fsPromise = requestFullscreen();
        if (fsPromise && typeof fsPromise.then === 'function') {
          fsPromise.catch(() => {
            // Ignore if fullscreen is blocked; modal view still works.
          });
        }
      } catch {
        // Ignore runtime fullscreen errors.
      }
    }
  }, [opened]);

  useEffect(() => {
    // When closing, stop and reset the video so it restarts cleanly next time
    if (!opened && videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch {
        // Ignore minor reset errors
      }
    }
  }, [opened]);

  useEffect(() => {
    if (!opened) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleFullscreenChange = (_event?: Event) => {
      // When fullscreen is exited (e.g., via ESC), also close the modal
      type FullscreenDocument = Document & {
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
        msFullscreenElement?: Element | null;
      };

      const fullscreenDoc = document as FullscreenDocument;
      const isFullscreen =
        fullscreenDoc.fullscreenElement ||
        fullscreenDoc.webkitFullscreenElement ||
        fullscreenDoc.mozFullScreenElement ||
        fullscreenDoc.msFullscreenElement;

      if (!isFullscreen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    // Vendor-prefixed fullscreen events for broader support
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange as EventListener);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange as EventListener);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange as EventListener);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange as EventListener);
    };
  }, [opened, onClose]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      fullScreen
      padding={0}
      styles={{
        body: {
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'black',
        },
        content: {
          backgroundColor: 'black',
        },
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'black',
        }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
          preload="auto"
          onLoadedMetadata={handleLoadedMetadata}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
      </div>
    </Modal>
  );
}
