import JSZip from 'jszip';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  epubVersion?: string;
}

export async function validateEpub(data: ArrayBuffer): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  try {
    const zip = await JSZip.loadAsync(data);

    // 1. Check mimetype file
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

    // 2. Check META-INF/container.xml
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) {
      result.errors.push('Missing "META-INF/container.xml".');
      result.isValid = false;
    } else {
      const containerXml = await containerFile.async('string');
      const fullPathMatch = containerXml.match(/full-path="([^"]+)"/);

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

          // Basic version check
          const versionMatch = opfXml.match(/<package[^>]+version="([^"]+)"/);
          if (versionMatch) {
            result.epubVersion = versionMatch[1];
            if (!result.epubVersion.startsWith('3.')) {
              result.warnings.push(`EPUB version is ${result.epubVersion}. Only EPUB 3.x is officially supported.`);
            }
          } else {
            result.warnings.push('Could not determine EPUB version from OPF file.');
          }

          // Check for NAV/NCX
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
    result.errors.push(`Failed to parse EPUB archive: ${(err as Error).message}`);
  }

  return result;
}
