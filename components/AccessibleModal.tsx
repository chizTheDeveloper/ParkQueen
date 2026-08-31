import React, { RefObject, useRef } from 'react';
import { useModalAccessibility } from '../hooks/useModalAccessibility';

interface AccessibleModalProps {
  ariaLabel: string;
  children: React.ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onDismiss?: () => void;
  overlayClassName: string;
  panelClassName: string;
}

export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  ariaLabel,
  children,
  initialFocusRef,
  returnFocusRef,
  onDismiss,
  overlayClassName,
  panelClassName,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalAccessibility({
    isOpen: true,
    dialogRef,
    initialFocusRef,
    returnFocusRef,
    onEscape: onDismiss,
  });

  return (
    <div data-modal-root="" className={overlayClassName}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={panelClassName}
      >
        {children}
      </div>
    </div>
  );
};
