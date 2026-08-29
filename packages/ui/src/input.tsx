import { type ComponentPropsWithoutRef, forwardRef, useId, useState } from 'react';
import { EyeIcon, EyeOffIcon } from './icons';

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label?: string;
  error?: string;
  helperText?: string;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    error,
    helperText,
    className = '',
    id,
    type = 'text',
    showPasswordLabel,
    hidePasswordLabel,
    ...props
  }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const describedBy = error ? `${inputId}-error` : helperText ? helperId : undefined;

    const showToggle = type === 'password' && !!showPasswordLabel && !!hidePasswordLabel;
    const [passwordVisible, setPasswordVisible] = useState(false);
    const inputType = showToggle ? (passwordVisible ? 'text' : 'password') : type;

    const toggleLabel = showToggle
      ? (passwordVisible ? hidePasswordLabel : showPasswordLabel)
      : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-foreground)] mb-1.5">
            {label}
          </label>
        )}
        <div className={`relative pw-field ${showToggle ? 'pw-field--has-toggle' : ''}`}>
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            spellCheck={props.spellCheck ?? (type === 'password' ? false : undefined)}
            autoCapitalize={props.autoCapitalize ?? (type === 'password' ? 'off' : undefined)}
            className={[
              'min-h-11 w-full rounded-[var(--radius-paper)] bg-[var(--color-paper)]',
              'border border-[var(--color-rule)] px-3 text-[var(--color-foreground)]',
              'placeholder:text-[var(--color-muted-foreground)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
              error ? 'border-[var(--color-accent-error)]' : '',
              className,
            ].filter(Boolean).join(' ')}
            {...props}
          />
          {showToggle && (
            <button
              type="button"
              aria-controls={inputId}
              aria-label={toggleLabel}
              title={toggleLabel}
              onClick={() => setPasswordVisible((v) => !v)}
              className="pw-toggle"
            >
              {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
              <span className="pw-toggle-label">{toggleLabel}</span>
            </button>
          )}
        </div>
        {error ? (
          <p id={errorId} className="mt-1.5 text-sm text-[var(--color-accent-error)]">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
