import { CommentInput } from '../annotations/CommentInput';

interface CommentInputModalProps {
  isOpen: boolean;
  selection: { text: string } | null;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  placeholder: string;
  submitLabel: string;
}

export function CommentInputModal({
  isOpen,
  selection,
  onSubmit,
  onCancel,
  placeholder,
  submitLabel,
}: CommentInputModalProps) {
  if (!isOpen || !selection) return null;

  return (
    <div
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 max-w-md mx-auto"
      style={{
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <h3 className="text-sm font-medium mb-3">{submitLabel}</h3>
      <CommentInput
        onSubmit={onSubmit}
        onCancel={onCancel}
        placeholder={placeholder}
        submitLabel={submitLabel}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: comment input should auto-focus for UX
        autoFocus
      />
    </div>
  );
}
