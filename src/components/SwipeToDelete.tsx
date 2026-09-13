import React, { useState, useRef, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

interface SwipeToDeleteProps {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
  disabled?: boolean;
  className?: string;
  roundedClass?: string;
  itemTitle?: string;
}

export function SwipeToDelete({
  children,
  onDelete,
  deleteLabel = 'Delete',
  disabled = false,
  className = '',
  roundedClass = 'rounded-xl',
  itemTitle,
}: SwipeToDeleteProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const isSwipingRef = useRef(false);
  const isDeterminedRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const SNAP_THRESHOLD = 65; // px to snap open action button
  const FULL_SWIPE_THRESHOLD = 140; // px to trigger immediate full-swipe delete
  const ACTION_WIDTH = 84; // px width of the revealed delete button

  const handleDelete = useCallback(() => {
    setIsDeleting(true);
    // Smooth exit animation
    setTimeout(() => {
      onDelete();
    }, 280);
  }, [onDelete]);

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isDeleting) return;
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    currentOffsetRef.current = isOpen ? -ACTION_WIDTH : 0;
    isSwipingRef.current = false;
    isDeterminedRef.current = false;
    hasDraggedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || isDeleting) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startXRef.current;
    const dy = touch.clientY - startYRef.current;

    if (!isDeterminedRef.current) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        isDeterminedRef.current = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          isSwipingRef.current = true;
          setIsDragging(true);
          hasDraggedRef.current = true;
        } else {
          isSwipingRef.current = false;
          return; // Allow native vertical page scrolling
        }
      } else {
        return;
      }
    }

    if (!isSwipingRef.current) return;

    const targetOffset = currentOffsetRef.current + dx;

    if (targetOffset < 0) {
      // Swiping left (revealing delete action)
      setOffsetX(targetOffset);
    } else {
      // Swiping right (apply gentle resistance if already closed)
      setOffsetX(Math.min(targetOffset * 0.25, 20));
    }
  };

  const handleTouchEnd = () => {
    if (!isSwipingRef.current) {
      setIsDragging(false);
      return;
    }

    setIsDragging(false);
    isSwipingRef.current = false;

    if (offsetX <= -FULL_SWIPE_THRESHOLD) {
      handleDelete();
    } else if (offsetX <= -SNAP_THRESHOLD) {
      setOffsetX(-ACTION_WIDTH);
      setIsOpen(true);
    } else {
      setOffsetX(0);
      setIsOpen(false);
    }
  };

  // Mouse / Pointer handlers for desktop mouse dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || isDeleting || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('a')) {
      return;
    }

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentOffsetRef.current = isOpen ? -ACTION_WIDTH : 0;
    isSwipingRef.current = false;
    isDeterminedRef.current = false;
    hasDraggedRef.current = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startXRef.current;
      const dy = moveEvent.clientY - startYRef.current;

      if (!isDeterminedRef.current) {
        if (Math.abs(dx) > 6) {
          isDeterminedRef.current = true;
          isSwipingRef.current = true;
          setIsDragging(true);
          hasDraggedRef.current = true;
        }
      }

      if (isSwipingRef.current) {
        const targetOffset = currentOffsetRef.current + dx;
        if (targetOffset < 0) {
          setOffsetX(targetOffset);
        } else {
          setOffsetX(Math.min(targetOffset * 0.2, 20));
        }
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (isSwipingRef.current) {
        setIsDragging(false);
        isSwipingRef.current = false;

        setOffsetX((prev) => {
          if (prev <= -FULL_SWIPE_THRESHOLD) {
            handleDelete();
            return -window.innerWidth;
          } else if (prev <= -SNAP_THRESHOLD) {
            setIsOpen(true);
            return -ACTION_WIDTH;
          } else {
            setIsOpen(false);
            return 0;
          }
        });
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Prevent accidental clicks on child elements if a swipe drag occurred or if currently snapped open
  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasDraggedRef.current = false;
      return;
    }

    if (isOpen) {
      e.stopPropagation();
      e.preventDefault();
      setOffsetX(0);
      setIsOpen(false);
    }
  };

  const isFullSwipeTriggered = offsetX <= -FULL_SWIPE_THRESHOLD;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${roundedClass} select-none transition-all duration-300 ${className}`}
      style={{
        maxHeight: isDeleting ? '0px' : '400px',
        opacity: isDeleting ? 0 : 1,
        marginBottom: isDeleting ? '0px' : undefined,
        transform: isDeleting ? 'scale(0.96)' : 'none',
        pointerEvents: isDeleting ? 'none' : 'auto',
      }}
    >
      {/* Background Action Layer */}
      <div
        className={`absolute inset-0 flex items-center justify-end px-4 ${roundedClass} transition-colors duration-200 z-0 ${
          isFullSwipeTriggered ? 'bg-rose-600 text-white' : 'bg-rose-500 text-white'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-transform active:scale-95 cursor-pointer"
          title={`Confirm ${deleteLabel}`}
        >
          <Trash2
            className={`w-4 h-4 transition-transform ${
              isFullSwipeTriggered ? 'scale-125 animate-pulse' : ''
            }`}
          />
          <span className="tracking-wide">
            {isFullSwipeTriggered ? 'Release to Delete' : deleteLabel}
          </span>
        </button>
      </div>

      {/* Foreground Draggable Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClickCapture={handleClickCapture}
        style={{
          transform: isDeleting ? 'translateX(-100%)' : `translateX(${offsetX}px)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
          touchAction: 'pan-y',
        }}
        className="relative z-10 w-full"
      >
        {children}
      </div>
    </div>
  );
}
