import { describe, expect, test } from 'bun:test';
import { resolveDropdownStyle } from '@/components/ui/selectPosition';

const css = await Bun.file('src/pages/LoginPage.module.scss').text();

/** 取出某个顶层规则块（不含嵌套块）的声明文本 */
const ruleBody = (selector: string) => {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`rule ${selector} not found`);
  let depth = 0;
  let body = '';
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    const char = css[i];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 1 && char !== '{') body += char;
    if (depth === 0) break;
  }
  return body;
};

describe('login layout on narrow screens (390×844)', () => {
  test('the single column shrinks with the viewport instead of overflowing', () => {
    const column = ruleBody('.column');
    expect(column).toContain('width: 100%');
    expect(column).toContain('max-width: 400px');
    expect(ruleBody('.container')).toContain('min-height: 100dvh');
  });

  test('the language menu is right-anchored so it opens inward on a narrow screen', () => {
    expect(ruleBody('.languageMenu')).toContain('right: 0');
    expect(css).not.toMatch(/min-width:\s*168px/);
  });
});

describe('login layout on short screens (390×280)', () => {
  test('the container top-aligns on short viewports so the panel is never clipped', () => {
    expect(css).toMatch(/@media \(max-height: 720px\) \{\s*justify-content: flex-start;/);
  });
});

describe('Select dropdown positioning', () => {
  const viewport = { width: 390, height: 844 };
  const trigger = { left: 300, right: 366, top: 19, bottom: 51, width: 66 };

  test('keeps the trigger width when no minimum is requested', () => {
    const style = resolveDropdownStyle(trigger, viewport.width, viewport.height);
    expect(style.width).toBe(66);
    expect(style.left).toBe(300);
  });

  test('widens to the minimum and right-aligns with a trigger near the right edge', () => {
    const style = resolveDropdownStyle(trigger, viewport.width, viewport.height, 180);
    expect(style.width).toBe(180);
    expect(style.left).toBe(366 - 180);
  });

  test('never exceeds the viewport', () => {
    const style = resolveDropdownStyle(trigger, 160, viewport.height, 180);
    expect(style.width).toBe(160 - 16);
    expect(style.left).toBe(8);
  });

  test('left-aligns when there is room to the right', () => {
    const left = { left: 24, right: 90, top: 19, bottom: 51, width: 66 };
    const style = resolveDropdownStyle(left, viewport.width, viewport.height, 180);
    expect(style.left).toBe(24);
    expect(style.width).toBe(180);
  });
});
