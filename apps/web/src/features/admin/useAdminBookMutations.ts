import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import type { TFunction } from '../../hooks/useTranslation';
import type { BookResponse } from '@do-epub-studio/shared';
import { stepUpErrorFromResponse } from './step-up';

interface CreateBookResponse {
  id: string;
  uploadUrl: string;
}

interface UseAdminBookMutationsOptions {
  executeWithStepUp: <T>(
    action: (token: string | null) => Promise<T>,
    token?: string,
  ) => Promise<T>;
  onSuccess: (message: string) => void;
  refreshBooks: () => Promise<void>;
  t: TFunction;
}

export function useAdminBookMutations({
  executeWithStepUp,
  onSuccess,
  refreshBooks,
  t,
}: UseAdminBookMutationsOptions) {
  // Create book state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [bookTitle, setBookTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [epubFile, setEpubFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState('private');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createMode, setCreateMode] = useState<'upload' | 'author'>('upload');
  const [authorTemplate, setAuthorTemplate] = useState<'blank' | 'novel' | 'guide'>('blank');
  const navigate = useNavigate();
  const [createError, setCreateError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revision upload state
  const [revisionBook, setRevisionBook] = useState<BookResponse | null>(null);
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [isRevisionSubmitting, setIsRevisionSubmitting] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [revisionValidation, setRevisionValidation] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const resetCreateForm = () => {
    setCreateMode('upload');
    setAuthorTemplate('blank');
    setBookTitle('');
    setAuthorName('');
    setEpubFile(null);
    setVisibility('private');
    setCreateError(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateEpubLocal = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      // EPUB validator (jszip) is lazy-loaded: only needed at book-upload time,
      // keeps it out of the admin-route entry chunk (bundle budget ADR-107 §3).
      const { validateEpub } = await import('@do-epub-studio/shared/src/epub-validator');
      const result = await validateEpub(data);

      const localizedErrors = result.errors.map((err) => {
        if (err.includes('mimetype')) return t('admin.createBookModal.error.missingMimetype');
        if (err.includes('META-INF/container.xml'))
          return t('admin.createBookModal.error.missingContainer');
        return err;
      });

      return {
        ...result,
        errors: localizedErrors,
      };
    } catch {
      return {
        isValid: false,
        errors: [t('admin.createBookModal.error.corruptZip')],
        warnings: [],
      };
    }
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bookTitle.trim()) {
      setCreateError(t('admin.createBookModal.error.fillFields'));
      return;
    }

    const slug =
      bookTitle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 255) || 'untitled';

    if (createMode === 'author') {
      setIsSubmitting(true);
      setCreateError(null);
      try {
        const res = await executeWithStepUp((tok) =>
          apiRequest<{ bookId: string; slug: string }>('/api/author/books', {
            method: 'POST',
            token: tok ?? undefined,
            body: JSON.stringify({
              title: bookTitle.trim(),
              slug,
              ...(authorName.trim() ? { authorName: authorName.trim() } : {}),
              visibility,
              template: authorTemplate,
            }),
          }),
        );
        setIsCreateModalOpen(false);
        resetCreateForm();
        await refreshBooks();
        onSuccess('Manuscript created. Opening author workspace...');
        void navigate(`/admin/books/${res.bookId}/author`);
      } catch (err) {
        setCreateError((err as Error).message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!epubFile) {
      setCreateError(t('admin.createBookModal.error.selectEpub'));
      return;
    }

    setCreateError(null);
    const localValidation = await validateEpubLocal(epubFile);
    setValidationResult(localValidation);
    if (!localValidation.isValid) {
      return;
    }

    setIsSubmitting(true);

    try {
      const createResult = await executeWithStepUp((tok) =>
        apiRequest<CreateBookResponse>('/api/admin/books', {
          method: 'POST',
          token: tok ?? undefined,
          body: JSON.stringify({
            title: bookTitle.trim(),
            slug,
            // `CreateBookSchema.authorName` is an optional string, not null;
            // sending null failed validation for every book without an author.
            ...(authorName.trim() ? { authorName: authorName.trim() } : {}),
            visibility,
          }),
        }),
      );

      const uploadUrl = createResult.uploadUrl;
      // The upload is itself a guarded mutation: a fresh session answers 428
      // STEP_UP_REQUIRED, so run it inside the step-up wrapper instead of a raw
      // fetch that can only fail.
      const uploadResponse = await executeWithStepUp(async (tok) => {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          body: epubFile,
          headers: {
            Authorization: `Bearer ${tok}`,
            'Content-Type': 'application/octet-stream',
          },
        });
        if (response.status === 428) {
          throw await stepUpErrorFromResponse(response);
        }
        return response;
      });

      if (!uploadResponse.ok) {
        const errorData = (await uploadResponse.json()) as {
          error?: { code?: string; message: string; details?: string[] };
        };
        if (errorData.error?.code === 'VALIDATION_ERROR' && errorData.error.details) {
          setValidationResult({
            isValid: false,
            errors: errorData.error.details,
            warnings: [],
          });
          throw new Error(errorData.error.message);
        }
        throw new Error(t('admin.createBookModal.error.upload'));
      }

      const uploadResult = (await uploadResponse.json()) as {
        data: {
          storageKey: string;
          validation?: { isValid: boolean; errors: string[]; warnings: string[] };
        };
      };

      await executeWithStepUp((tok) =>
        apiRequest(`/api/admin/books/${createResult.id}/upload-complete`, {
          method: 'POST',
          token: tok ?? undefined,
          body: JSON.stringify({
            storageKey: uploadResult.data.storageKey,
            originalFilename: epubFile.name,
            fileSizeBytes: epubFile.size,
            mimeType: epubFile.type || 'application/epub+zip',
            validationResults: uploadResult.data.validation,
          }),
        }),
      );

      if (uploadResult.data.validation) {
        setValidationResult(uploadResult.data.validation);
      }

      setIsCreateModalOpen(false);
      resetCreateForm();
      onSuccess(t('admin.createBookModal.success'));
      void refreshBooks();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionFile || !revisionBook) return;

    const localValidation = await validateEpubLocal(revisionFile);
    setRevisionValidation(localValidation);
    if (!localValidation.isValid) return;

    setIsRevisionSubmitting(true);
    setRevisionError(null);

    try {
      const uploadUrl = `/api/admin/books/${revisionBook.id}/upload`;
      const uploadResponse = await executeWithStepUp(async (tok) => {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          body: revisionFile,
          headers: {
            Authorization: `Bearer ${tok}`,
            'Content-Type': 'application/octet-stream',
          },
        });
        if (response.status === 428) {
          throw await stepUpErrorFromResponse(response);
        }
        return response;
      });

      if (!uploadResponse.ok) {
        throw new Error(t('admin.createBookModal.error.upload'));
      }

      const uploadResult = (await uploadResponse.json()) as {
        data: {
          storageKey: string;
          validation?: { isValid: boolean; errors: string[]; warnings: string[] };
        };
      };

      const finalizeResult = await executeWithStepUp((tok) =>
        apiRequest<{ id: string }>(`/api/admin/books/${revisionBook.id}/upload-complete`, {
          method: 'POST',
          token: tok ?? undefined,
          body: JSON.stringify({
            storageKey: uploadResult.data.storageKey,
            originalFilename: revisionFile.name,
            fileSizeBytes: revisionFile.size,
            mimeType: revisionFile.type || 'application/epub+zip',
            validationResults: uploadResult.data.validation,
          }),
        }),
      );

      await executeWithStepUp((tok) =>
        apiRequest(`/api/admin/books/${revisionBook.id}/revisions/${finalizeResult.id}/migrate`, {
          method: 'POST',
          token: tok ?? undefined,
          body: JSON.stringify({}),
        }),
      );

      setRevisionBook(null);
      setRevisionFile(null);
      onSuccess(t('admin.books.revisionSuccess'));
      void refreshBooks();
    } catch (err) {
      setRevisionError((err as Error).message);
    } finally {
      setIsRevisionSubmitting(false);
    }
  };

  return {
    isCreateModalOpen,
    setIsCreateModalOpen,
    bookTitle,
    setBookTitle,
    authorName,
    setAuthorName,
    epubFile,
    setEpubFile,
    visibility,
    setVisibility,
    createMode,
    setCreateMode,
    authorTemplate,
    setAuthorTemplate,
    isSubmitting,
    createError,
    validationResult,
    handleCreateBook,
    resetCreateForm,
    revisionBook,
    setRevisionBook,
    revisionFile,
    setRevisionFile,
    isRevisionSubmitting,
    revisionError,
    setRevisionError,
    revisionValidation,
    setRevisionValidation,
    handleUploadRevision,
  };
}
