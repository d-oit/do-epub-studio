import versionText from '../../../../VERSION?raw';
import metadata from './app-identity.json';

export const APP_NAME = metadata.name;
export const APP_SHORT_NAME = metadata.shortName;
export const APP_DESCRIPTION = metadata.description;
export const APP_VERSION = versionText.trim();
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
