import { type ComponentPropsWithoutRef, forwardRef, useId, useState } from 'react';
import { EyeIcon, EyeOffIcon } from './icons';

export interface InputProps extends ComponentPropsWithoutRef<'input'> {
  label?: string;
  error?: string;
  helperText?: string;
  /**
   * When provided (with `hidePasswordLabel`) AND `type === 'password'`, renders
   * a trailing "show/hide password" toggle per GOV.UK / WCAG 3.3.8 best
   * practice: an eye icon plus a changing action label ("Show password" ↔
   * "Hide password") with `aria-controls` pointing at the field, no
   * `aria-pressed`, focus stays on the button, and the password value is never
   * announced. At `sm+` the icon and the localized label are both visible; on
   * the smallest screens only the icon renders and the label becomes the
   * button's `aria-label` — long-locale labels (e.g. French "Afficher le mot
   * de passe") would otherwise overflow the input's padding reservation.
   */
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
    const describedBy = error ? errorId : helperText ? helperId : undefined;

    // Toggle exists only for password fields that provide localized labels.
    const showToggle = type === 'password' && !!showPasswordLabel && !!hidePasswordLabel;
    const [passwordVisible, setPasswordVisible] = useState(false);
    const inputType = showToggle ? (passwordVisible ? 'text' : 'password') : type;

    const toggleLabel = showToggle
      ? (passwordVisible ? hidePasswordLabel : showPasswordLabel)
      : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            spellCheck={props.spellCheck ?? (type === 'password' ? false : undefined)}
            autoCapitalize={props.autoCapitalize ?? (type === 'password' ? 'off' : undefined)}
            className={`
              w-full px-4 py-3 bg-background border rounded-lg
              text-foreground placeholder:text-foreground-muted
              transition-all duration-150
              outline-none
              ${showToggle ? 'pr-12 sm:pr-28' : ''}
              ${error ? 'border-accent-error focus:border-accent-error focus:ring-accent-error/15' : 'border-border focus:border-accent focus:ring-[3px] focus:ring-accent/15'}
              ${className}
            `}
            {...(props)}
          />
          {showToggle && (
            <button
              type="button"
              aria-controls={inputId}
              aria-expanded={passwordVisible}
              aria-label={toggleLabel}
              onClick={() => setPasswordVisible((v) => !v)}
              className="absolute inset-y-0 right-1.5 my-auto flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-accent hover:bg-background hover:underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
              <span className="hidden sm:inline">{toggleLabel}</span>
            </button>
          )}
        </div>
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
