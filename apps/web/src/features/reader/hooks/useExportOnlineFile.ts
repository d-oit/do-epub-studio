import { useCallback, useState } from 'react';
import { ExportTextResponseSchema } from '@do-epub-studio/schema';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';

export type OnlineExportFormat = 'html' | 'epub';

interface UseExportOnlineFileResult {
  isExporting: boolean;
  hasError: boolean;
  clearError: () => void;
  downloadOnlineExport: (format: OnlineExportFormat) => Promise<boolean>;
}

export function useExportOnlineFile(): UseExportOnlineFileResult {
  const bookId = useAuthStore((state) => state.bookId);
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isExporting, setIsExporting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const clearError = useCallback(() => setHasError(false), []);
  const downloadOnlineExport = useCallback(
    async (format: OnlineExportFormat): Promise<boolean> => {
      setHasError(false);
      if (!bookId || !sessionToken) {
        setHasError(true);
        return false;
      }

      setIsExporting(true);
      try {
        const endpoint = `/api/books/${encodeURIComponent(bookId)}/export?format=${format}`;
        const response = await api.get(endpoint, {
          token: sessionToken,
          headers: { Accept: format === 'epub' ? 'application/epub+zip' : 'application/json' },
        });
        if (!response.ok) throw new Error('Export request failed');

        let blob: Blob;
        let filename: string;
        if (format === 'html') {
          const parsed = ExportTextResponseSchema.safeParse(await response.json());
          if (!parsed.success || parsed.data.data.format !== 'html') {
            throw new Error('The HTML export response is invalid');
          }
          blob = new Blob([parsed.data.data.content], { type: 'text/html;charset=utf-8' });
          filename = 'annotations.html';
        } else {
          const contentType = response.headers
            .get('content-type')
            ?.split(';', 1)[0]
            ?.trim()
            .toLowerCase();
          if (contentType !== 'application/epub+zip') {
            throw new Error('The EPUB export response has an invalid media type');
          }
          blob = await response.blob();
          filename = 'annotations.epub';
        }
        if (blob.size === 0) throw new Error('The export file is empty');

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.hidden = true;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        return true;
      } catch {
        setHasError(true);
        return false;
      } finally {
        setIsExporting(false);
      }
    },
    [bookId, sessionToken],
  );

  return { isExporting, hasError, clearError, downloadOnlineExport };
}
