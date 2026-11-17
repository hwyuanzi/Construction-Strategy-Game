import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

function site(page: Page, name: string) {
  return page.getByRole('button', { name: new RegExp(`^Build ${name},`) })
}

test('builds by clicking the city and finishes against Normal', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Last Brick' })).toBeVisible()
  await expect(page.getByText('Your turn', { exact: true })).toBeVisible()
  await page.getByText('Think it through').click()
  await expect(page.locator('.strategy')).toContainText('Try 1 brick on site 2 (Workshop)')
  await expect(site(page, 'House')).toContainText('Finish now')
  await page.getByRole('button', { name: 'Place 1 brick', exact: true }).click()
  await expect(site(page, 'House')).not.toContainText('Finish now')
  await page.getByRole('button', { name: /^Map site 2, Workshop/ }).click()
  await expect(page.locator('.activity')).toContainText('added 1 brick to site 2.')
  await expect(page.getByRole('button', { name: 'Place 3 bricks', exact: true })).toHaveAttribute('aria-pressed', 'true')

  for (let turn = 1; turn < 6; turn++) {
    await site(page, 'House').click()
  }
  await expect(page.locator('#results-title')).toHaveText(/wins!|You win!|A tie!/)
  await expect(page.getByText('Round 6 of 6')).toBeVisible()
  await expect(site(page, 'Tower')).toBeDisabled()
  expect(errors).toEqual([])
})

test('plays a full six-player game with a custom city and individual first trucks', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New game' }).click()
  await page.getByRole('button', { name: 'Pass & play' }).click()
  await page.getByRole('button', { name: '6', exact: true }).click()
  await page.getByLabel('Starting bricks for Player 1').selectOption('5')
  await page.getByLabel('Starting bricks for Player 6').selectOption('7')
  await page.getByRole('button', { name: 'Remove House' }).click()
  await page.getByRole('button', { name: 'Remove Workshop' }).click()
  await page.getByRole('button', { name: 'Remove Tower' }).click()
  await expect(page.getByRole('button', { name: 'Start game' })).toBeDisabled()
  await page.getByRole('button', { name: 'Add Library' }).click()
  await page.getByRole('button', { name: 'Add Library' }).click()
  await page.getByRole('button', { name: 'Add Apartments' }).click()
  await page.getByRole('button', { name: 'Start game' }).click()

  await expect(page.locator('.score')).toHaveCount(6)
  await expect(page.getByRole('button', { name: /^Map site/ })).toHaveCount(3)
  await expect(site(page, 'Library')).toHaveCount(2)
  await expect(site(page, 'House')).toHaveCount(0)
  await expect(page.getByText('5 bricks on the truck')).toBeVisible()
  for (let turn = 0; turn < 36; turn++) {
    if (turn === 5) {
      await expect(page.getByText('Player 6’s turn')).toBeVisible()
      await expect(page.getByText('7 bricks on the truck')).toBeVisible()
    }
    await site(page, 'Library').first().click()
  }
  await expect(page.locator('#results-title')).toBeVisible()
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByText('Player 2’s turn')).toBeVisible()
  await expect(site(page, 'Library')).toHaveCount(2)
})

test('runs Hard in a worker with the full twelve-site map', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New game' }).click()
  await page.getByRole('button', { name: 'Hard', exact: true }).click()
  const addSite = page.getByRole('button', { name: 'Add Apartments' })
  for (let i = 0; i < 5; i++) await addSite.click()
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Add Tower' }).click()
  await expect(addSite).toBeDisabled()
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.getByRole('button', { name: /^Map site/ })).toHaveCount(12)
  const blocked = await page.locator('.map-target span').evaluateAll(markers => markers.filter(marker => {
    const box = marker.getBoundingClientRect()
    const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return target?.closest('button') !== marker.closest('button')
  }).map(marker => marker.textContent))
  expect(blocked).toEqual([])
  await expect(page.locator('.score.player-1')).toContainText('Hard')
  const worker = page.waitForEvent('worker')
  await page.getByRole('button', { name: /^Map site 1, House/ }).locator('span').click()
  await expect(site(page, 'Tower').first()).toBeDisabled()
  expect((await worker).url()).toMatch(/bot\.worker/)
  await expect(page.getByText('Your turn', { exact: true })).toBeVisible()
  await expect(page.locator('.activity')).toContainText('Computer')
})

test('keeps settings usable at phone width and plays Easy with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'How to play' }).click()
  await expect(page.getByRole('dialog').getByRole('listitem')).toHaveCount(3)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'New game' }).click()
  await page.getByRole('button', { name: 'Easy', exact: true }).click()
  await page.getByLabel('Starting bricks for You').selectOption('7')
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.getByText('7 bricks on the truck')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Bricks to place' }).getByRole('button')).toHaveCount(7)
  await expect(page.locator('.score.player-1')).toContainText('Easy')
  expect(await page.locator('body').evaluate(body => body.scrollWidth)).toBeLessThanOrEqual(320)
  await expect(page.getByRole('button', { name: /^Map site 1, House/ })).toBeInViewport()
  await page.getByRole('button', { name: 'Place 2 bricks', exact: true }).click()
  await page.getByRole('button', { name: /^Map site 1, House/ }).click()
  await expect(page.locator('.score.player-0')).toContainText('2 stars')
})
