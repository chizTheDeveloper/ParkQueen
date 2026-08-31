import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    ariaLabel: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, children, ariaLabel }) => {
    const [visible, setVisible] = useState(false);
    const dragStartY = useRef<number | null>(null);
    const sheetRef = useRef<HTMLDivElement>(null);
    const [dragOffset, setDragOffset] = useState(0);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => setVisible(true));
        } else {
            setVisible(false);
        }
    }, [isOpen]);

    const dismiss = useCallback(() => {
        setVisible(false);
        setTimeout(onClose, 300);
    }, [onClose]);

    useModalAccessibility({ isOpen, dialogRef: sheetRef, onEscape: dismiss });

    const handleTouchStart = (e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (dragStartY.current === null) return;
        const dy = e.touches[0].clientY - dragStartY.current;
        setDragOffset(Math.max(0, dy));
    };

    const handleTouchEnd = () => {
        if (dragOffset > 80) dismiss();
        setDragOffset(0);
        dragStartY.current = null;
    };

    if (!isOpen) return null;

    return (
        <div data-modal-root="" className="absolute inset-0 z-30">
            <div
                className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
                onClick={dismiss}
            />
            <div
                ref={sheetRef}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                className="absolute bottom-0 left-0 right-0 bg-[var(--color-surface)] rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-h-[85vh] overflow-y-auto"
                style={{ transform: visible ? `translateY(${dragOffset}px)` : 'translateY(100%)' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
                </div>
                <div className="px-5 pb-8">
                    {children}
                </div>
            </div>
        </div>
    );
};
