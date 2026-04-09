import { useState, useRef, useEffect } from 'react';

interface CommentInputProps {
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  initialText?: string;
  submitLabel?: string;
  isReply?: boolean;
}

export function CommentInput({
  onSubmit,
  onCancel,
  placeholder = 'Write a comment...',
  autoFocus = false,
  initialText = '',
  submitLabel = 'Comment',
  isReply = false,
}: CommentInputProps) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    <div
      className={`space-y-2 ${isReply ? 'pl-4 border-l-2 border-gray-200 dark:border-gray-700' : ''}`}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full p-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        rows={3}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitLabel}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-right">Ctrl+Enter to submit</p>
    </div>
  );
}
