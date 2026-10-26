// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({ site: process.env.DEPLOY_ENVIRONMENT === 'development' ? 'https://dev.fanfareuid.ch' : 'https://fanfareuid.ch', output: 'static' });
