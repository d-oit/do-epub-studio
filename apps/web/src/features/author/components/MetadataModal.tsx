import { useEffect, useState } from 'react';
import type { AuthorAssetMetadata, AuthorPublication } from '@do-epub-studio/shared';
import { Button, Modal } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';

interface MetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  publication: AuthorPublication;
  assets: AuthorAssetMetadata[];
  onSave: (updates: Partial<AuthorPublication>) => void;
}

const fieldClassName =
  'min-h-11 w-full rounded-sm border border-border bg-background px-3 py-2 text-base text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function MetadataModal({
  isOpen,
  onClose,
  publication,
  assets,
  onSave,
}: MetadataModalProps) {
  const { t } = useTranslation();
  const [draftPublication, setDraftPublication] = useState(publication);
  const [creatorsText, setCreatorsText] = useState(publication.creators.join('\n'));

  useEffect(() => {
    if (!isOpen) return;
    setDraftPublication(publication);
    setCreatorsText(publication.creators.join('\n'));
  }, [isOpen, publication]);

  function updateDraft(updates: Partial<AuthorPublication>) {
    setDraftPublication((current) => ({ ...current, ...updates }));
  }

  function saveAndClose() {
    const creators = creatorsText
      .split('\n')
      .map((creator) => creator.trim())
      .filter(Boolean);
    const nextPublication =
      creators.length > 0 ? { ...draftPublication, creators } : draftPublication;
    onSave(nextPublication);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={saveAndClose} title={t('author.metadata.title')}>
      <div className="max-h-[70dvh] space-y-4 overflow-y-auto pe-1">
        <div>
          <label htmlFor="metadata-title" className="mb-1 block text-sm font-medium">
            {t('author.metadata.publicationTitle')}
          </label>
          <input
            id="metadata-title"
            type="text"
            value={draftPublication.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            className={fieldClassName}
            maxLength={500}
          />
        </div>
        <div>
          <label htmlFor="metadata-creators" className="mb-1 block text-sm font-medium">
            {t('author.metadata.creators')}
          </label>
          <textarea
            id="metadata-creators"
            rows={3}
            value={creatorsText}
            onChange={(event) => setCreatorsText(event.target.value)}
            aria-describedby="metadata-creators-hint"
            className={fieldClassName}
            maxLength={5_200}
          />
          <p id="metadata-creators-hint" className="mt-1 text-sm text-foreground-muted">
            {t('author.metadata.creatorsHint')}
          </p>
        </div>
        <div>
          <label htmlFor="metadata-language" className="mb-1 block text-sm font-medium">
            {t('author.metadata.language')}
          </label>
          <input
            id="metadata-language"
            type="text"
            value={draftPublication.language}
            onChange={(event) => updateDraft({ language: event.target.value })}
            className={fieldClassName}
            maxLength={10}
          />
        </div>
        <div>
          <label htmlFor="metadata-identifier" className="mb-1 block text-sm font-medium">
            {t('author.metadata.identifier')}
          </label>
          <input
            id="metadata-identifier"
            type="text"
            value={draftPublication.identifier ?? ''}
            onChange={(event) => updateDraft({ identifier: event.target.value || undefined })}
            className={fieldClassName}
            maxLength={255}
          />
        </div>
        <div>
          <label htmlFor="metadata-description" className="mb-1 block text-sm font-medium">
            {t('author.metadata.description')}
          </label>
          <textarea
            id="metadata-description"
            rows={3}
            value={draftPublication.description ?? ''}
            onChange={(event) => updateDraft({ description: event.target.value })}
            className={fieldClassName}
            maxLength={5_000}
          />
        </div>
        <div>
          <label htmlFor="metadata-publisher" className="mb-1 block text-sm font-medium">
            {t('author.metadata.publisher')}
          </label>
          <input
            id="metadata-publisher"
            type="text"
            value={draftPublication.publisher ?? ''}
            onChange={(event) => updateDraft({ publisher: event.target.value })}
            className={fieldClassName}
            maxLength={255}
          />
        </div>
        <div>
          <label htmlFor="metadata-rights" className="mb-1 block text-sm font-medium">
            {t('author.metadata.rights')}
          </label>
          <input
            id="metadata-rights"
            type="text"
            value={draftPublication.rights ?? ''}
            onChange={(event) => updateDraft({ rights: event.target.value })}
            className={fieldClassName}
            maxLength={500}
          />
        </div>
        <div>
          <label htmlFor="metadata-cover" className="mb-1 block text-sm font-medium">
            {t('author.metadata.cover')}
          </label>
          <select
            id="metadata-cover"
            value={draftPublication.coverImageAssetId ?? ''}
            onChange={(event) => updateDraft({ coverImageAssetId: event.target.value || null })}
            className={fieldClassName}
          >
            <option value="">{t('author.metadata.noCover')}</option>
            {assets
              .filter((asset) => asset.mediaType.startsWith('image/'))
              .map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex justify-end pt-2">
          <Button type="button" onClick={saveAndClose} className="min-h-11">
            {t('author.metadata.done')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
