import type { StorybookConfig } from '@storybook/react';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: true,
  },
  typescript: {
    // Disable react-docgen to avoid Babel 8 loadPartialConfig incompatibility.
    // Storybook 10.5.0's react-docgen-plugin calls loadPartialConfig synchronously,
    // but Babel 8 requires the async variant. react-docgen-typescript is used instead.
    reactDocgen: 'react-docgen-typescript',
  },
  viteFinal: (viteConfig) => {
    viteConfig.plugins?.push(tailwindcss());
    return viteConfig;
  },
};

export default config;
