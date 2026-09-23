import { test, expect } from "@playwright/test";

/** Prüft Installation des Service Workers und einen vollständigen Offline-Aufruf. @param {object} fixtures Playwright-Fixtures mit Browserseite. @returns {Promise<void>} Prüfabschluss. */
async function offlineLaunch({ page, context }) {
  await page.goto("/");
  await page.evaluate(async function waitForOfflineShell() {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) {
      throw new Error("Service Worker wurde nicht aktiviert");
    }
  });
  await expect(page.locator(".word-node")).toHaveCount(12);
  await page.locator("#words-x").fill("Persistenter Gedanke");
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#words-x")).toHaveValue("Persistenter Gedanke");
  await expect(page.locator(".word-node")).toHaveCount(1);
  await expect(page.locator("#node-count")).toHaveText("1");
  await expect(page.locator("#view canvas")).toBeVisible();
}

test("PWA launches from the app shell without network", offlineLaunch);
