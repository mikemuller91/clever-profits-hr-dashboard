'use client';

import { useEffect, useCallback } from 'react';
import { useSwipeGesture, SwipeDirection } from '@/hooks/useSwipeGesture';

interface SwipeCardProps {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isActive: boolean;
  stackIndex: number; // 0 = front, 1 = first behind, 2 = second behind
}

export default function SwipeCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  isActive,
  stackIndex,
}: SwipeCardProps) {
  const { state, handlers, reset } = useSwipeGesture({
    threshold: 100,
    thresholdPercent: 30,
    onSwipeLeft,
    onSwipeRight,
  });

  // Handle keyboard shortcuts when active
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return;

    if (e.key === 'ArrowLeft' || e.key === 'n' || e.key === 'N') {
      onSwipeLeft();
    } else if (e.key === 'ArrowRight' || e.key === 'y' || e.key === 'Y') {
      onSwipeRight();
    }
  }, [isActive, onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    if (isActive) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isActive, handleKeyDown]);

  // Reset swipe state when card becomes active
  useEffect(() => {
    if (isActive) {
      reset();
    }
  }, [isActive, reset]);

  // Calculate transform based on swipe state
  const getTransform = () => {
    if (!isActive || stackIndex !== 0) {
      // Stack cards behind
      const scale = 1 - stackIndex * 0.05;
      const translateY = stackIndex * 8;
      return `scale(${scale}) translateY(${translateY}px)`;
    }

    const rotation = state.offsetX * 0.05;
    return `translate3d(${state.offsetX}px, ${state.offsetY * 0.3}px, 0) rotate(${rotation}deg)`;
  };

  // Get overlay opacity based on swipe direction
  const getOverlayStyle = (direction: SwipeDirection) => {
    if (!isActive || stackIndex !== 0) return { opacity: 0 };

    const progress = Math.min(Math.abs(state.offsetX) / 150, 1);

    if (direction === 'left' && state.offsetX < 0) {
      return { opacity: progress * 0.5 };
    }
    if (direction === 'right' && state.offsetX > 0) {
      return { opacity: progress * 0.5 };
    }
    return { opacity: 0 };
  };

  const cardStyle = {
    transform: getTransform(),
    transition: state.isSwiping ? 'none' : 'transform 0.3s ease-out',
    zIndex: 10 - stackIndex,
    opacity: stackIndex > 1 ? 0 : 1 - stackIndex * 0.15,
    pointerEvents: (isActive && stackIndex === 0 ? 'auto' : 'none') as 'auto' | 'none',
  };

  return (
    <div
      className="absolute inset-0 select-none"
      style={{
        ...cardStyle,
        touchAction: 'none',
      }}
      {...(isActive && stackIndex === 0 ? handlers : {})}
    >
      {/* Card Content */}
      <div className="w-full h-full relative">
        {children}

        {/* Left overlay (red - Not Qualified) */}
        <div
          className="absolute inset-0 bg-red-500 rounded-2xl pointer-events-none flex items-center justify-center"
          style={getOverlayStyle('left')}
        >
          <div className="text-white text-4xl font-bold transform -rotate-12 border-4 border-white px-6 py-2 rounded-lg">
            NOT QUALIFIED
          </div>
        </div>

        {/* Right overlay (green - Reviewed) */}
        <div
          className="absolute inset-0 bg-green-500 rounded-2xl pointer-events-none flex items-center justify-center"
          style={getOverlayStyle('right')}
        >
          <div className="text-white text-4xl font-bold transform rotate-12 border-4 border-white px-6 py-2 rounded-lg">
            REVIEWED
          </div>
        </div>
      </div>
    </div>
  );
}
