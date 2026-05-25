import JSZip from 'jszip';
import { matchBounded } from '@do-epub-studio/shared';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  epubVersion?: string;
}

const MAX_XML_LENGTH = 1_048_576;
const FULL_PATH_RE = /full-path="([^"]{1,4096})"/;
const VERSION_RE = /<package[^>]{0,4096}version="([^"]{1,20})"/;

export async function validateEpub(data: ArrayBuffer): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  try {
    const zip = await JSZip.loadAsync(data);

    const mimetypeFile = zip.file('mimetype');
    if (!mimetypeFile) {
      result.errors.push('Missing "mimetype" file.');
      result.isValid = false;
    } else {
      const mimetype = (await mimetypeFile.async('string')).trim();
      if (mimetype !== 'application/epub+zip') {
        result.errors.push(`Invalid mimetype: expected "application/epub+zip", got "${mimetype}".`);
        result.isValid = false;
      }
    }

    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) {
      result.errors.push('Missing "META-INF/container.xml".');
      result.isValid = false;
    } else {
      const containerXml = await containerFile.async('string');
      const fullPathMatch = matchBounded(FULL_PATH_RE, containerXml, MAX_XML_LENGTH);

      if (!fullPathMatch) {
        result.errors.push('Could not find rootfile path in "META-INF/container.xml".');
        result.isValid = false;
      } else {
        const opfPath = fullPathMatch[1];
        const opfFile = zip.file(opfPath);

        if (!opfFile) {
          result.errors.push(`OPF file not found at path: ${opfPath}`);
          result.isValid = false;
        } else {
          const opfXml = await opfFile.async('string');

          const versionMatch = matchBounded(VERSION_RE, opfXml, MAX_XML_LENGTH);
          if (versionMatch) {
            result.epubVersion = versionMatch[1];
            if (!result.epubVersion.startsWith('3.')) {
              result.warnings.push(`EPUB version is ${result.epubVersion}. Only EPUB 3.x is officially supported.`);
            }
          } else {
            result.warnings.push('Could not determine EPUB version from OPF file.');
          }

          if (!opfXml.includes('properties="nav"') && !opfXml.includes('id="nav"')) {
            const hasNcx = opfXml.includes('media-type="application/x-dtbncx+xml"');
            if (!hasNcx) {
              result.warnings.push('No NAV or NCX table of contents found.');
            }
          }
        }
      }
    }
  } catch (err) {
    result.isValid = false;
    const message = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to parse EPUB archive: ${message}`);
  }

  return result;
}
