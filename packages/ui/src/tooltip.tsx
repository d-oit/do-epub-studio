import { useId, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const id = useId();
  const tooltipId = `tooltip-${id}`;

  const show = useCallback(() => setIsVisible(true), []);
  const hide = useCallback(() => setIsVisible(false), []);

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {typeof children === 'object' && children !== null && 'type' in children ? (
        <span
          onFocus={show}
          onBlur={hide}
          aria-describedby={isVisible ? tooltipId : undefined}
        >
          {children}
        </span>
      ) : (
        <span onFocus={show} onBlur={hide} aria-describedby={isVisible ? tooltipId : undefined}>
          {children}
        </span>
      )}
      {isVisible && (
        <motion.div
          id={tooltipId}
          role="tooltip"
          initial={{ opacity: 0, y: 'calc(0.5 * var(--motion-item-offset))' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 'calc(0.5 * var(--motion-item-offset))' }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-foreground rounded shadow-lg whitespace-nowrap z-50 pointer-events-none"
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
        </motion.div>
      )}
    </div>
  );
}
