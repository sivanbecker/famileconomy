import type { Config } from 'tailwindcss'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharedConfig = require('../../packages/ui/tailwind.config') as { default: Config }

const config: Config = {
  presets: [sharedConfig.default],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
}

export default config
