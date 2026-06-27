import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../');
const appIdentityJson = JSON.parse(
  readFileSync(join(REPO_ROOT, 'apps/web/src/config/app-identity.json'), 'utf8'),
);

interface AppIdentity {
  name: string;
  shortName: string;
  description: string;
}

const appIdentity = appIdentityJson as AppIdentity;
const appVersion = readFileSync(join(REPO_ROOT, 'VERSION'), 'utf8').trim();
const viewports = [
  { label: 'mobile', width: 375, height: 812 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'wide', width: 1920, height: 1080 },
] as const;

test.describe('App identity and responsive shell', () => {
  test('uses the shared app identity in document metadata and manifest', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveTitle(appIdentity.name);
    await expect(page.locator('meta[name="application-name"]')).toHaveAttribute('content', appIdentity.name);
    await expect(page.locator('meta[name="app-version"]')).toHaveAttribute('content', appVersion);

    const manifestResponse = await page.request.get('/manifest.webmanifest');
    expect(manifestResponse.ok()).toBe(true);

    const manifest = (await manifestResponse.json()) as {
      name?: string;
      short_name?: string;
      description?: string;
      version?: string;
    };
    expect(manifest.name).toBe(appIdentity.name);
    expect(manifest.short_name).toBe(appIdentity.shortName);
    expect(manifest.description).toBe(appIdentity.description);
    expect(manifest.version).toBe(appVersion);
  });

  test('@mobile keeps the login experience usable from mobile to wide screens', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/login');

      await expect(page.getByRole('heading', { name: appIdentity.name })).toBeVisible();
      await expect(page.getByText(`Version v${appVersion}`)).toBeVisible();
      await expect(page.getByLabel('Email Address')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${viewport.label} viewport should not scroll horizontally`).toBe(false);
    }
  });
});
