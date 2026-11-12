import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = process.env.E2E_OUT || "e2e-screenshots";
const stamp = Date.now().toString(36);
const owner = { name: "E2E Tester", email: `e2e-${stamp}@bookly.dev`, password: "testpass123" };
const biz = { name: "E2E Studio", slug: `e2e-studio-${stamp}`, description: "Automated end-to-end test studio" };
const authStateFile = path.join(OUT, ".state.json");

test.describe.configure({ mode: "serial" });

let bookingDate = ""; // ISO yyyy-mm-dd of the date we book on
let bookedSlot = ""; // ISO timestamp of the slot we book

function shotDir(folder: string) {
  const dir = path.join(OUT, folder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Playwright gives every test a fresh context, so the session cookie from the
 *  signup test must be restored manually into later tests. */
async function restoreAuth(page: Page) {
  if (!fs.existsSync(authStateFile)) throw new Error("No auth state — signup test must run first");
  const state = JSON.parse(fs.readFileSync(authStateFile, "utf8"));
  await page.context().addCookies(state.cookies);
}

/** pick the first date within `days` that has open slots for the business */
async function findDateWithSlots(page: Page, slug: string): Promise<string> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  for (let i = 0; i < 14; i++) {
    const iso = fmt(new Date(Date.now() + i * 86400_000));
    const res = await page.request.get(`/api/public/business/${slug}/slots?date=${iso}`);
    const j = await res.json();
    if ((j.slots || []).length > 0) return iso;
  }
  throw new Error("No date with open slots found within 14 days");
}

const slotButtons = (page: Page) => page.locator("main .grid button").filter({ hasText: ":" });

/** Set the date on the public booking page and wait until slot buttons render.
 *  Filling the date input before React has hydrated can swallow the change
 *  event (the input shows the date but React state still holds today, whose
 *  slots may be empty) — so re-fill until the slots actually appear. */
async function selectDateAndWaitForSlots(page: Page, date: string) {
  const input = page.locator('input[type="date"]');
  for (let attempt = 0; attempt < 5; attempt++) {
    await input.fill(""); // clear first so re-filling always re-fires onChange
    await input.fill(date);
    try {
      await expect(slotButtons(page).first()).toBeVisible({ timeout: 4000 });
      return;
    } catch {
      // hydration race — retry with a fresh change event
    }
  }
  throw new Error(`Slots for ${date} never appeared on the booking page`);
}

test("01 · Landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Bookly/);
  await expect(page.locator("header").getByText("Bookly")).toBeVisible();
  const dir = shotDir("01-landing-page");
  await page.screenshot({ path: path.join(dir, "01-hero.png") });
  await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
  await page.screenshot({ path: path.join(dir, "02-cta-buttons.png") });
});

test("02 · Signup new user", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  const dir = shotDir("02-signup-new-user");
  await page.screenshot({ path: path.join(dir, "01-signup-form.png") });

  await page.getByPlaceholder("Jane Doe").fill(owner.name);
  await page.getByPlaceholder("you@business.com").fill(owner.email);
  await page.getByPlaceholder("At least 6 characters").fill(owner.password);
  await page.screenshot({ path: path.join(dir, "02-form-filled.png") });

  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText("Welcome aboard")).toBeVisible();
  await page.screenshot({ path: path.join(dir, "03-signed-in-onboarding.png") });

  // persist session for later tests (each test gets a fresh context)
  await page.context().storageState({ path: authStateFile });
});

test("03 · Create business", async ({ page }) => {
  const dir = shotDir("03-onboarding-create-business");

  await restoreAuth(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Welcome aboard")).toBeVisible();
  await page.getByPlaceholder("Glow Salon").fill(biz.name);
  await page.getByPlaceholder("glow-salon").fill(biz.slug);
  await page.getByPlaceholder("What do you offer?").fill(biz.description);
  await page.screenshot({ path: path.join(dir, "01-form-filled.png") });

  await page.getByRole("button", { name: "Create business" }).click();
  await expect(page.locator("select")).toContainText(biz.name);
  await expect(page.locator(`a[href="/book/${biz.slug}"]`)).toBeVisible();
  await expect(page.locator("nav button")).toHaveCount(4);
  await page.screenshot({ path: path.join(dir, "02-business-created.png") });
});

test("04 · Set working hours", async ({ page }) => {
  const dir = shotDir("04-set-working-hours");

  await restoreAuth(page);
  await page.goto("/dashboard");
  await expect(page.locator("select")).toContainText(biz.name);
  await page.locator('nav button:has-text("hours")').click();
  await expect(page.locator("button", { hasText: "Save hours" })).toBeVisible();
  await page.screenshot({ path: path.join(dir, "01-hours-form.png") });

  // label.relative items are the 7 day switches, order: Sun(0) … Sat(6)
  const switches = page.locator("label.relative");
  for (const idx of [1, 2, 3]) await switches.nth(idx).click(); // Mon, Tue, Wed
  await page.screenshot({ path: path.join(dir, "02-mon-wed-enabled.png") });

  await page.getByRole("button", { name: "Save hours" }).click();
  await page.waitForTimeout(1200);
  const times = await page.locator("input[type=time]").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(times).toEqual(["09:00", "17:00", "09:00", "17:00", "09:00", "17:00"]);
  await page.screenshot({ path: path.join(dir, "03-hours-saved.png") });
});

test("05 · Add services", async ({ page }) => {
  const dir = shotDir("05-add-services");

  await restoreAuth(page);
  await page.goto("/dashboard");
  await expect(page.locator("select")).toContainText(biz.name);
  await page.locator('nav button:has-text("services")').click();
  await expect(page.getByText("No services yet")).toBeVisible();
  await page.screenshot({ path: path.join(dir, "01-empty-state.png") });

  const add = async (name: string, duration: string, price: string) => {
    await page.getByPlaceholder("e.g. Consultation").fill(name);
    await page.getByPlaceholder("min").fill(duration);
    await page.getByPlaceholder("$0").fill(price);
    await page.getByRole("button", { name: "Add service" }).click();
    await expect(page.locator("ul li", { hasText: name })).toBeVisible();
  };
  await add("Piano Lesson", "45", "$50");
  await page.screenshot({ path: path.join(dir, "02-first-service-added.png") });

  await add("Guitar Lesson", "30", "$40");
  await expect(page.locator("ul li", { hasText: "Piano Lesson" })).toBeVisible();
  await expect(page.locator("ul li", { hasText: "Guitar Lesson" })).toBeVisible();
  await page.screenshot({ path: path.join(dir, "03-two-services.png") });
});

test("06 · Public booking page", async ({ page }) => {
  const dir = shotDir("06-public-booking-page");
  await page.goto(`/book/${biz.slug}`);
  await expect(page.getByRole("heading", { name: biz.name })).toBeVisible();
  await expect(page.locator("select option")).toHaveCount(2);
  await page.screenshot({ path: path.join(dir, "01-hero-and-form.png") });

  bookingDate = await findDateWithSlots(page, biz.slug);
  await selectDateAndWaitForSlots(page, bookingDate);
  const res = await page.request.get(`/api/public/business/${biz.slug}/slots?date=${bookingDate}`);
  bookedSlot = (await res.json()).slots[0].start; // we will book this first slot in test 07
  await page.screenshot({ path: path.join(dir, "02-available-slots.png") });
});

test("07 · Book appointment", async ({ page }) => {
  const dir = shotDir("07-book-appointment-as-customer");
  await page.goto(`/book/${biz.slug}`);
  await expect(page.getByRole("heading", { name: biz.name })).toBeVisible();
  await selectDateAndWaitForSlots(page, bookingDate);

  await slotButtons(page).first().click();
  await page.screenshot({ path: path.join(dir, "01-slot-selected.png") });

  await page.getByPlaceholder("Full name").fill("Test Customer");
  await page.getByPlaceholder("you@example.com").fill("customer@e2e.dev");
  await page.getByPlaceholder("Phone (optional)").fill("+1 555 0101");
  await page.screenshot({ path: path.join(dir, "02-details-filled.png") });

  await page.getByRole("button", { name: "Book appointment" }).click();
  await expect(page.getByText("You're booked!")).toBeVisible();
  await page.screenshot({ path: path.join(dir, "03-booking-confirmed.png") });
});

test("08 · Dashboard bookings", async ({ page }) => {
  const dir = shotDir("08-dashboard-bookings");

  await restoreAuth(page);
  await page.goto("/dashboard");
  await expect(page.locator("ul li", { hasText: "customer@e2e.dev" })).toBeVisible();
  await page.screenshot({ path: path.join(dir, "01-bookings-list.png") });

  // the slot booked in test 07 must no longer be offered publicly
  const res = await page.request.get(`/api/public/business/${biz.slug}/slots?date=${bookingDate}`);
  const offered = (await res.json()).slots.map((s: { start: string }) => s.start);
  expect(offered).not.toContain(bookedSlot);
  await page.screenshot({ path: path.join(dir, "02-booked-slot-removed.png") });
});

test("09 · Theme switcher", async ({ page }) => {
  const dir = shotDir("09-theme-switcher");
  await page.goto("/");
  await page.waitForTimeout(1500);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  await page.screenshot({ path: path.join(dir, "01-initial.png") });

  await page.locator('[aria-label*="mode"]').click();
  await page.waitForTimeout(400);
  const nowDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  expect(nowDark).toBe(!isDark);
  const saved = await page.evaluate(() => localStorage.getItem("theme"));
  expect(saved).toBe(nowDark ? "dark" : "light");
  await page.screenshot({ path: path.join(dir, "02-toggled.png") });
});

test("10 · Logout and login", async ({ page }) => {
  const dir = shotDir("10-logout-and-login");

  await restoreAuth(page);
  await page.goto("/dashboard");
  await expect(page.locator("select")).toContainText(biz.name);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForTimeout(1500);
  expect(page.url()).not.toContain("/dashboard");
  await page.screenshot({ path: path.join(dir, "01-logged-out.png") });

  await page.goto("/dashboard");
  await page.waitForURL("**/login**");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.screenshot({ path: path.join(dir, "02-redirected-to-login.png") });

  await page.getByPlaceholder("you@business.com").fill(owner.email);
  await page.getByPlaceholder("••••••••").fill(owner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.locator("select")).toContainText(biz.name);
  await page.screenshot({ path: path.join(dir, "03-logged-back-in.png") });
});
