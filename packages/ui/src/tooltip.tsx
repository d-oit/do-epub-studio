import { useId, useRef, useState, useCallback, useEffect, type ReactNode } from 'react';

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
}

function detectPopoverSupport(): boolean {
  return (
    typeof HTMLElement !== 'undefined' &&
    'popover' in HTMLElement.prototype &&
    typeof HTMLElement.prototype.showPopover === 'function'
  );
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const id = useId();
  const tooltipId = `tooltip-${id}`;
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [supportsNative, setSupportsNative] = useState(detectPopoverSupport);

  useEffect(() => {
    setSupportsNative(detectPopoverSupport());
  }, []);

  useEffect(() => {
    const el = popoverRef.current;
    if (!el || !supportsNative) return;
    const handleToggle = (event: Event) => {
      setIsOpen((event as ToggleEvent).newState === 'open');
    };
    el.addEventListener('toggle', handleToggle);
    return () => {
      el.removeEventListener('toggle', handleToggle);
    };
  }, [supportsNative]);

  const show = useCallback(() => {
    if (supportsNative) {
      const el = popoverRef.current;
      if (el && !el.matches(':popover-open')) {
        try {
          el.showPopover();
        } catch {
          setIsOpen(true);
        }
      }
      return;
    }
    setIsOpen(true);
  }, [supportsNative]);

  const hide = useCallback(() => {
    if (supportsNative) {
      const el = popoverRef.current;
      if (el && el.matches(':popover-open')) {
        try {
          el.hidePopover();
        } catch {
          setIsOpen(false);
        }
      }
      return;
    }
    setIsOpen(false);
  }, [supportsNative]);

  const sideClasses =
    side === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      : 'top-full left-1/2 -translate-x-1/2 mt-2';

  const arrowClasses =
    side === 'top'
      ? 'absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground'
      : 'absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-foreground';

  const shouldRender = supportsNative || isOpen;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span aria-describedby={isOpen ? tooltipId : undefined}>{children}</span>
      {shouldRender && (
        <div
          ref={popoverRef}
          id={tooltipId}
          role="tooltip"
          data-side={side}
          data-fallback={supportsNative ? undefined : 'js'}
          {...(supportsNative ? { popover: 'auto' as const } : {})}
          className={`${sideClasses} px-2 py-1 text-xs text-white bg-foreground rounded shadow-lg whitespace-nowrap z-50 pointer-events-none`}
          style={
            supportsNative
              ? { margin: 0 }
              : {
                  position: 'absolute',
                  opacity: isOpen ? 1 : 0,
                  pointerEvents: 'none',
                  transition: 'opacity 150ms',
                }
          }
        >
          {content}
          <div className={arrowClasses} aria-hidden="true" />
        </div>
      )}
    </span>
  );
}
