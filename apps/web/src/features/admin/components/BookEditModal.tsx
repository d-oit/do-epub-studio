import { useTranslation } from '../../../hooks/useTranslation';
import { Modal, Button } from '../../../components/ui';

interface BookEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  editTitle: string;
  setEditTitle: (v: string) => void;
  editAuthor: string;
  setEditAuthor: (v: string) => void;
  editDescription: string;
  setEditDescription: (v: string) => void;
  editVisibility: string;
  setEditVisibility: (v: string) => void;
  isEditSubmitting: boolean;
  editError: string | null;
}

export function BookEditModal({
  isOpen,
  onClose,
  onSubmit,
  editTitle,
  setEditTitle,
  editAuthor,
  setEditAuthor,
  editDescription,
  setEditDescription,
  editVisibility,
  setEditVisibility,
  isEditSubmitting,
  editError,
}: BookEditModalProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('admin.books.editTitle')}>
      <form onSubmit={(e) => { void onSubmit(e); }} className="space-y-4">
        <div>
          <label htmlFor="edit-title" className="block text-sm font-medium text-foreground-muted mb-1">
            {t('admin.createBookModal.titleLabel')}
          </label>
          <input
            id="edit-title"
            type="text"
            value={editTitle}
            onChange={(e) => { setEditTitle(e.target.value); }}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          />
        </div>

        <div>
          <label htmlFor="edit-author" className="block text-sm font-medium text-foreground-muted mb-1">
            {t('admin.createBookModal.authorLabel')}
          </label>
          <input
            id="edit-author"
            type="text"
            value={editAuthor}
            onChange={(e) => { setEditAuthor(e.target.value); }}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          />
        </div>

        <div>
          <label htmlFor="edit-description" className="block text-sm font-medium text-foreground-muted mb-1">
            {t('admin.createBookModal.descriptionLabel')}
          </label>
          <textarea
            id="edit-description"
            value={editDescription}
            onChange={(e) => { setEditDescription(e.target.value); }}
            rows={3}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all resize-none"
          />
        </div>

        <div>
          <label htmlFor="edit-visibility" className="block text-sm font-medium text-foreground-muted mb-1">
            {t('admin.createBookModal.visibilityLabel')}
          </label>
          <select
            id="edit-visibility"
            value={editVisibility}
            onChange={(e) => { setEditVisibility(e.target.value); }}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          >
            <option value="private">{t('admin.createBookModal.visibilityPrivate')}</option>
            <option value="public">{t('admin.createBookModal.visibilityPublic')}</option>
          </select>
        </div>

        {editError && (
          <div className="p-3 bg-semantic-error/10 border border-semantic-error/30 rounded-lg text-sm text-semantic-error">
            {editError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('admin.createBookModal.close')}
          </Button>
          <Button type="submit" isLoading={isEditSubmitting}>
            {isEditSubmitting ? t('admin.createBookModal.submitting') : t('admin.books.saveChanges')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
