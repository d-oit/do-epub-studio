import { type ComponentPropsWithoutRef, forwardRef, useId } from 'react';

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const describedBy = error ? errorId : helperText ? helperId : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={`
            w-full px-4 py-3 bg-background border rounded-lg
            text-foreground placeholder:text-foreground-muted
            transition-all duration-150
            outline-none
            ${error ? 'border-accent-error focus:border-accent-error focus:ring-accent-error/15' : 'border-border focus:border-accent focus:ring-[3px] focus:ring-accent/15'}
            ${className}
          `}
          {...(props)}
        />
        {error ? (
          <p id={errorId} className="mt-1.5 text-sm text-accent-error">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="mt-1.5 text-sm text-foreground-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
