import type { AuthorPublication } from '@do-epub-studio/shared';
import { Modal, Button } from '../../../components/ui';

interface MetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  publication: AuthorPublication;
  onSave: (updates: Partial<AuthorPublication>) => void;
}

const META_TEXT = {
  title: 'Publication Metadata',
  pubTitle: 'Publication Title',
  author: 'Author / Creator',
  language: 'Language (ISO code)',
  description: 'Description',
  done: 'Done',
} as const;

export function MetadataModal({ isOpen, onClose, publication, onSave }: MetadataModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={META_TEXT.title}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground-muted mb-1">
            {META_TEXT.pubTitle}
          </label>
          <input
            type="text"
            value={publication.title}
            onChange={(e) => onSave({ title: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-muted mb-1">
            {META_TEXT.author}
          </label>
          <input
            type="text"
            value={publication.authorName}
            onChange={(e) => onSave({ authorName: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-muted mb-1">
            {META_TEXT.language}
          </label>
          <input
            type="text"
            value={publication.language}
            onChange={(e) => onSave({ language: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-muted mb-1">
            {META_TEXT.description}
          </label>
          <textarea
            rows={3}
            value={publication.description || ''}
            onChange={(e) => onSave({ description: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>{META_TEXT.done}</Button>
        </div>
      </div>
    </Modal>
  );
}
