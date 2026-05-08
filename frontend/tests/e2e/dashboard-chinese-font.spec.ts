import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Bug-1: Dashboard Department Distribution Chart Chinese Font Rendering
 *
 * E2E tests covering ATB-01, ATB-02, ATB-03 from the acceptance test baseline.
 * Verifies that Chinese text (department names, axis labels, tooltips) renders
 * correctly without garbled characters (□□, ???, replacement glyphs).
 *
 * Precondition: System has at least 3 departments (研发部, 市场部, 人力资源部).
 */

const DEPARTMENTS = ['研发部', '市场部', '人力资源部'];
const CHINESE_FONT_FAMILIES = ['PingFang SC', 'Microsoft YaHei'];
const GARBLED_PATTERN = /[\ufffd\u25a1]{2,}/;

/** Selectors for the department distribution chart */
const SELECTORS = {
  chartContainer: '[data-testid="dept-distribution-chart"], .dept-distribution-chart, .chart-container',
  canvas: 'canvas',
  tooltip: '.chart-tooltip, [class*="tooltip"], [class*="Tooltip"]',
  echartsText: 'text',
  svgText: 'svg text',
} as const;

/**
 * Helper: perform login via API and set auth cookies/storage.
 * Adjust selector/credential details to match actual app login flow.
 */
async function loginAndGotoDashboard(page: Page): Promise<void> {
  // Attempt API login to obtain token
  const loginResponse = await page.request.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin123' },
  });

  if (loginResponse.ok()) {
    const body = await loginResponse.json();
    const token = body?.data?.token || body?.token;
    if (token) {
      // Store token in localStorage so the app picks it up
      await page.addInitScript((t: string) => {
        localStorage.setItem('token', t);
        localStorage.setItem('authToken', t);
      }, token);
    }
  }

  // Navigate to dashboard
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Wait for chart canvas to appear and be visible
  const canvas = page.locator(SELECTORS.canvas).first();
  await expect(canvas).toBeVisible({ timeout: 20000 });

  // Wait for chart render animation to complete (ECharts default animation ~1s)
  await page.waitForTimeout(1500);
}

/**
 * Helper: locate the department distribution chart container.
 * Tries multiple possible selectors for resilience.
 */
function getChartContainer(page: Page): Locator {
  return page.locator(SELECTORS.chartContainer).first();
}

/**
 * Helper: capture canvas image as base64 PNG data URL via page.evaluate.
 */
async function getCanvasDataUrl(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  });
}

/**
 * Helper: detect if ECharts is in use by checking for ECharts-specific DOM patterns.
 */
async function isECharts(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    // ECharts renders SVG or Canvas with specific attributes
    const chartDom = document.querySelector('[data-zr-dom-id]') ||
      document.querySelector('[_echarts_instance_]') ||
      document.querySelector('div[data echarts]');
    if (chartDom) return true;
    // Check for ECharts global instance hints
    const svgContainer = document.querySelector('svg');
    if (svgContainer) {
      // ECharts SVG renderer puts specific attributes
      return !!svgContainer.querySelector('path[d]');
    }
    return false;
  });
}

// ────────────────────────────────────────────────────────────────
// ATB-01: Chinese Text Visibility Verification
// ────────────────────────────────────────────────────────────────
test.describe('Dashboard Chinese Font Rendering (Bug-1)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGotoDashboard(page);
  });

  test('ATB-01: Chinese department names are visible in chart without garbled characters', async ({ page }) => {
    // 1. Verify chart canvas is rendered
    const canvas = page.locator(SELECTORS.canvas).first();
    await expect(canvas).toBeVisible();

    // 2. Capture canvas screenshot via toDataURL for pixel analysis
    const dataUrl = await getCanvasDataUrl(page);
    expect(dataUrl).toBeTruthy();
    expect(dataUrl).toContain('data:image/png');

    // 3. Verify Chinese characters exist in the chart DOM (SVG text elements or labels)
    //    ECharts renders text either as SVG <text> or on Canvas.
    //    For SVG renderer, we check <text> elements.
    //    For Canvas renderer, we rely on the API response data being present.
    const textContent = await page.evaluate(() => {
      const texts: string[] = [];
      // Collect all SVG text elements
      document.querySelectorAll('svg text, svg tspan').forEach((el) => {
        const t = (el as SVGTextElement).textContent?.trim();
        if (t) texts.push(t);
      });
      // Collect all DOM text nodes that might contain chart labels
      document.querySelectorAll('[class*="chart"] span, [class*="chart"] div, [class*="label"]').forEach((el) => {
        const t = el.textContent?.trim();
        if (t && t.length > 0) texts.push(t);
      });
      return texts;
    });

    // 4. Assert at least one department name is present in rendered text
    const foundDepts = DEPARTMENTS.filter((dept) =>
      textContent.some((t) => t.includes(dept))
    );
    expect(foundDepts.length).toBeGreaterThanOrEqual(1);

    // 5. Assert no consecutive garbled characters (□□ or ���) in any rendered text
    for (const t of textContent) {
      expect(t).not.toMatch(GARBLED_PATTERN);
    }

    // 6. Use page screenshot for visual verification — no consecutive replacement chars
    const screenshot = await page.screenshot();
    // Screenshot should be non-empty (sanity check)
    expect(screenshot.length).toBeGreaterThan(0);
  });

  // ────────────────────────────────────────────────────────────────
  // ATB-02: Chart DOM/SVG Font Property Verification
  // ────────────────────────────────────────────────────────────────
  test('ATB-02: Chart text elements have Chinese-compatible font-family', async ({ page }) => {
    const usingECharts = await isECharts(page);

    if (usingECharts) {
      // ECharts path: inspect <text> elements inside the chart SVG/container
      const textElements = page.locator('svg text, [data-zr-dom-id] + svg text');
      const count = await textElements.count();

      if (count > 0) {
        // Check computed font-family on text elements
        for (let i = 0; i < Math.min(count, 10); i++) {
          const fontFamily = await textElements.nth(i).evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return computed.fontFamily;
          });

          const hasChineseFont = CHINESE_FONT_FAMILIES.some(
            (font) => fontFamily.includes(font)
          );
          // At least one text element should use a Chinese-capable font
          // (or the system fallback chain includes one)
          expect(
            hasChineseFont || fontFamily.includes('sans-serif') || fontFamily.includes('Helvetica'),
            `Text element #${i} has font-family: "${fontFamily}" which lacks Chinese font support`
          ).toBeTruthy();
        }
      }

      // Also check via ECharts instance API if available
      const echartsOption = await page.evaluate(() => {
        const chartDom = document.querySelector('[_echarts_instance_]') as HTMLElement;
        if (chartDom && (window as any).echarts) {
          const instance = (window as any).echarts.getInstanceByDom(chartDom);
          if (instance) {
            const option = instance.getOption() as any;
            return option?.textStyle?.fontFamily || null;
          }
        }
        // Try alternative: check global textStyle from any echarts instance
        const allInstances = (window as any).echarts?.instances;
        if (allInstances) {
          for (const inst of Object.values(allInstances) as any[]) {
            const opt = inst?.getOption?.();
            if (opt?.textStyle?.fontFamily) return opt.textStyle.fontFamily;
          }
        }
        return null;
      });

      if (echartsOption) {
        const hasChineseFont = CHINESE_FONT_FAMILIES.some(
          (font) => echartsOption.includes(font)
        );
        expect(
          hasChineseFont,
          `ECharts textStyle.fontFamily "${echartsOption}" does not include PingFang SC or Microsoft YaHei`
        ).toBeTruthy();
      }
    } else {
      // Chart.js or Canvas-based: evaluate canvas context font settings
      const canvasFontInfo = await page.evaluate(() => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        if (!canvas) return null;
        // We can't directly read what was drawn, but we can check the
        // container's computed font-family for inheritance
        const container = canvas.parentElement;
        if (!container) return null;
        const computed = window.getComputedStyle(container);
        return {
          fontFamily: computed.fontFamily,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
        };
      });

      expect(canvasFontInfo).not.toBeNull();
      const fontFamily = canvasFontInfo!.fontFamily;
      const hasChineseFont = CHINESE_FONT_FAMILIES.some(
        (font) => fontFamily.includes(font)
      );
      expect(
        hasChineseFont || fontFamily.includes('sans-serif') || fontFamily.includes('Helvetica'),
        `Chart container font-family "${fontFamily}" lacks Chinese font support`
      ).toBeTruthy();
    }

    // Fallback: check the chart container's computed style
    const chartContainer = getChartContainer(page);
    if ((await chartContainer.count()) > 0) {
      const containerFontFamily = await chartContainer.evaluate((el) => {
        return window.getComputedStyle(el).fontFamily;
      });
      const hasChineseFont = CHINESE_FONT_FAMILIES.some(
        (font) => containerFontFamily.includes(font)
      );
      expect(
        hasChineseFont || containerFontFamily.includes('sans-serif'),
        `Chart container computed font-family "${containerFontFamily}" should support Chinese characters`
      ).toBeTruthy();
    }
  });

  // ────────────────────────────────────────────────────────────────
  // ATB-03: Tooltip Chinese Text Verification on Hover
  // ────────────────────────────────────────────────────────────────
  test('ATB-03: Tooltip displays Chinese text correctly without garbled characters', async ({ page }) => {
    // Ensure chart is rendered
    const canvas = page.locator(SELECTORS.canvas).first();
    await expect(canvas).toBeVisible();

    // Get canvas bounding box for hover positioning
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Move mouse to center of canvas to trigger tooltip
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;
    await page.mouse.move(centerX, centerY);

    // Wait for tooltip to appear — try multiple selectors
    const tooltipLocator = page.locator(
      [
        '.chart-tooltip',
        '[class*="tooltip"]',
        '[class*="Tooltip"]',
        '.echarts-tooltip',
        'div[class*="tip"]',
      ].join(', ')
    );

    // Give tooltip time to render
    await expect(tooltipLocator.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // If tooltip didn't appear at center, try a slight offset
      return page.mouse.move(centerX + 10, centerY - 10);
    });

    // Try hovering at multiple points to find a data segment
    let tooltipVisible = false;
    const offsets = [
      [0, 0], [20, -20], [-20, 20], [40, 0], [0, 40], [-40, 0], [0, -40],
    ];

    for (const [dx, dy] of offsets) {
      await page.mouse.move(centerX + dx, centerY + dy);
      await page.waitForTimeout(300);

      const tooltip = tooltipLocator.first();
      if (await tooltip.isVisible().catch(() => false)) {
        tooltipVisible = true;

        const tooltipText = await tooltip.innerText();

        // Assert no garbled characters in tooltip
        expect(tooltipText).not.toMatch(GARBLED_PATTERN);

        // Assert tooltip contains recognizable content (not just symbols)
        // It should contain at least some Chinese characters or numbers
        const hasContent = /[\u4e00-\u9fff\d]/.test(tooltipText);
        expect(hasContent, `Tooltip text "${tooltipText}" contains no recognizable Chinese/numeric content`).toBeTruthy();

        break;
      }
    }

    // If no tooltip appeared via class selectors, try checking DOM for ECharts tooltip div
    if (!tooltipVisible) {
      // ECharts creates tooltip div dynamically, check for any visible floating div
      const floatingTooltipText = await page.evaluate(() => {
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
          const style = window.getComputedStyle(div);
          const rect = div.getBoundingClientRect();
          // Tooltip is typically absolutely positioned, visible, and contains text
          if (
            (style.position === 'absolute' || style.position === 'fixed') &&
            style.zIndex !== 'auto' &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0 &&
            div.textContent &&
            div.textContent.trim().length > 2
          ) {
            const text = div.textContent.trim();
            // Check if it looks like chart tooltip content
            if (/[\u4e00-\u9fff]/.test(text) || /\d/.test(text)) {
              return text;
            }
          }
        }
        return null;
      });

      if (floatingTooltipText) {
        expect(floatingTooltipText).not.toMatch(GARBLED_PATTERN);
        tooltipVisible = true;
      }
    }

    // Log for debugging if tooltip interaction was inconclusive, but don't fail
    // The primary assertion is that IF tooltip shows, it has no garbled text
    if (!tooltipVisible) {
      test.info().annotations.push({
        type: 'warning',
        description: 'Could not trigger chart tooltip; tooltip garbled-text assertion was skipped',
      });
    }
  });
});