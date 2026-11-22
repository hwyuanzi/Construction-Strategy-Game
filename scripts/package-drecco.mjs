import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'dist/drecco')
const folder = resolve(output, 'content/games/2026/last-brick')
const archive = resolve(output, 'last-brick.zip')

const bundledLicenses = [
  'react/LICENSE',
  'react-dom/LICENSE',
  'scheduler/LICENSE',
  'framer-motion/LICENSE.md',
  'motion-dom/LICENSE.md',
  'motion-utils/LICENSE.md',
  'lucide-react/LICENSE',
  '@fontsource-variable/inter/LICENSE',
  'tailwindcss/LICENSE',
]
const html = await readFile(resolve(output, 'iframe.html'), 'utf8')
const notices = await Promise.all(bundledLicenses.map(async file => {
  const license = await readFile(resolve(root, 'node_modules', file), 'utf8')
  return `${dirname(file)}\n${license.trim()}`
}))
const licenseText = notices.join('\n\n').replaceAll('&', '&amp;').replaceAll('<', '&lt;')

await mkdir(folder, { recursive: true })
await Promise.all([
  writeFile(resolve(folder, 'iframe.html'), html.replace('</body>', () =>
    `<template id="third-party-licenses">\n${licenseText}\n</template>\n  </body>`,
  )),
  copyFile(resolve(root, 'drecco/index.md'), resolve(folder, 'index.md')),
  copyFile(resolve(root, 'drecco/thumbnail.png'), resolve(folder, 'thumbnail.png')),
])

execFileSync('zip', ['-q', '-X', archive, 'last-brick/index.md', 'last-brick/iframe.html', 'last-brick/thumbnail.png'], {
  cwd: dirname(folder),
  stdio: 'inherit',
})
console.log(`Dr. Ecco folder: ${folder}\nSubmission ZIP: ${archive}`)
