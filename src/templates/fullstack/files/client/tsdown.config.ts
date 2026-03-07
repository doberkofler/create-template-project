import {defineConfig} from 'tsdown';

export default defineConfig({entry: ['./src/main.tsx'], format: ['esm'], clean: true});
