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
  viteFinal: (viteConfig) => {
    viteConfig.plugins?.push(tailwindcss());
    return viteConfig;
  },
};

export default config;
