'use client';

import { useCallback, useRef, useState } from 'react';

export type SwipeDirection = 'left' | 'right' | null;

interface SwipeState {
  offsetX: number;
  offsetY: number;
  direction: SwipeDirection;
  isSwiping: boolean;
}

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

interface UseSwipeGestureOptions {
  threshold?: number; // pixels or percentage of card width
  thresholdPercent?: number; // percentage of card width (0-100)
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeCancel?: () => void;
}

interface UseSwipeGestureReturn {
  state: SwipeState;
  handlers: SwipeHandlers;
  reset: () => void;
}

export function useSwipeGesture(options: UseSwipeGestureOptions = {}): UseSwipeGestureReturn {
  const {
    threshold = 100,
    thresholdPercent = 30,
    onSwipeLeft,
    onSwipeRight,
    onSwipeCancel,
  } = options;

  const [state, setState] = useState<SwipeState>({
    offsetX: 0,
    offsetY: 0,
    direction: null,
    isSwiping: false,
  });

  const startPos = useRef({ x: 0, y: 0 });
  const cardWidth = useRef(0);
  const isMouseDown = useRef(false);

  const getSwipeThreshold = useCallback(() => {
    if (cardWidth.current > 0) {
      return Math.min(threshold, (cardWidth.current * thresholdPercent) / 100);
    }
    return threshold;
  }, [threshold, thresholdPercent]);

  const getDirection = useCallback((offsetX: number): SwipeDirection => {
    const swipeThreshold = getSwipeThreshold();
    if (offsetX > swipeThreshold) return 'right';
    if (offsetX < -swipeThreshold) return 'left';
    return null;
  }, [getSwipeThreshold]);

  const reset = useCallback(() => {
    setState({
      offsetX: 0,
      offsetY: 0,
      direction: null,
      isSwiping: false,
    });
    isMouseDown.current = false;
  }, []);

  const handleStart = useCallback((clientX: number, clientY: number, element: HTMLElement) => {
    startPos.current = { x: clientX, y: clientY };
    cardWidth.current = element.offsetWidth;
    setState(prev => ({ ...prev, isSwiping: true }));
  }, []);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const offsetX = clientX - startPos.current.x;
    const offsetY = clientY - startPos.current.y;
    const direction = getDirection(offsetX);

    setState({
      offsetX,
      offsetY,
      direction,
      isSwiping: true,
    });
  }, [getDirection]);

  const handleEnd = useCallback(() => {
    const { offsetX } = state;
    const direction = getDirection(offsetX);

    if (direction === 'left' && onSwipeLeft) {
      onSwipeLeft();
    } else if (direction === 'right' && onSwipeRight) {
      onSwipeRight();
    } else {
      onSwipeCancel?.();
      reset();
    }
  }, [state, getDirection, onSwipeLeft, onSwipeRight, onSwipeCancel, reset]);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY, e.currentTarget as HTMLElement);
  }, [handleStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!state.isSwiping) return;
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  }, [state.isSwiping, handleMove]);

  const onTouchEnd = useCallback(() => {
    if (!state.isSwiping) return;
    handleEnd();
  }, [state.isSwiping, handleEnd]);

  // Mouse handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isMouseDown.current = true;
    handleStart(e.clientX, e.clientY, e.currentTarget as HTMLElement);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isMouseDown.current) return;
      handleMove(moveEvent.clientX, moveEvent.clientY);
    };

    const onMouseUp = () => {
      if (!isMouseDown.current) return;
      isMouseDown.current = false;
      handleEnd();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [handleStart, handleMove, handleEnd]);

  return {
    state,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseDown,
    },
    reset,
  };
}
