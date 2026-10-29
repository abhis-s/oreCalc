import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    BRAND_TOOLS_REGISTRY,
    buildBrandToolHref,
    renderBrandToolsDropdown,
    initBrandToolsDropdown,
    closeBrandToolsDropdown,
    toggleBrandToolsDropdown
} from '../../js/components/common/brandToolsDropdown.js';

describe('Brand Tools Dropdown Architecture & Registry', () => {
    test('contains exactly 5 canonical primary tool descriptors', () => {
        assert.equal(BRAND_TOOLS_REGISTRY.length, 5);

        const ids = BRAND_TOOLS_REGISTRY.map(tool => tool.id);
        assert.deepEqual(ids, ['hub', 'ore-calculator', 'hero-journey', 'damage-calculator', 'account']);
    });

    test('every tool descriptor defines valid identifiers, paths, icons, and translation keys', () => {
        for (const tool of BRAND_TOOLS_REGISTRY) {
            assert.ok(tool.id && typeof tool.id === 'string');
            assert.ok(tool.path && typeof tool.path === 'string');
            assert.ok(tool.labelKey && typeof tool.labelKey === 'string');
            assert.ok(tool.defaultLabel && typeof tool.defaultLabel === 'string');
            assert.ok(tool.icon && typeof tool.icon === 'string');
        }
    });

    test('damage calculator reuses existing equipment damage badge translation key', () => {
        const damageTool = BRAND_TOOLS_REGISTRY.find(t => t.id === 'damage-calculator');
        assert.ok(damageTool);
        assert.equal(damageTool.labelKey, 'views.damageCalc.offense.equipmentDamageBadge');
        assert.equal(damageTool.defaultLabel, 'Equipment Damage');
    });

    test('uses filled vector icon variants across primary tools', () => {
        const hub = BRAND_TOOLS_REGISTRY.find(t => t.id === 'hub');
        const oreCalc = BRAND_TOOLS_REGISTRY.find(t => t.id === 'ore-calculator');
        const damageCalc = BRAND_TOOLS_REGISTRY.find(t => t.id === 'damage-calculator');
        const account = BRAND_TOOLS_REGISTRY.find(t => t.id === 'account');
        assert.equal(hub?.icon, 'home-filled');
        assert.equal(oreCalc?.icon, 'equipment-filled');
        assert.equal(damageCalc?.icon, 'swords-filled');
        assert.equal(account?.icon, 'user-filled');
    });
});

describe('Brand Tools URL & Parameter Resolution', () => {
    test('builds root path for hub in English and localized prefix for other languages', () => {
        const hub = BRAND_TOOLS_REGISTRY.find(t => t.id === 'hub');
        assert.ok(hub);

        assert.equal(buildBrandToolHref(hub, 'en'), '/');
        assert.equal(buildBrandToolHref(hub, 'de'), '/de/');
        assert.equal(buildBrandToolHref(hub, 'tr'), '/tr/');
    });

    test('appends active player tag only to tools supporting tag persistence', () => {
        const oreCalc = BRAND_TOOLS_REGISTRY.find(t => t.id === 'ore-calculator');
        const heroJourney = BRAND_TOOLS_REGISTRY.find(t => t.id === 'hero-journey');
        const damageCalc = BRAND_TOOLS_REGISTRY.find(t => t.id === 'damage-calculator');
        const account = BRAND_TOOLS_REGISTRY.find(t => t.id === 'account');
        const hub = BRAND_TOOLS_REGISTRY.find(t => t.id === 'hub');

        assert.ok(oreCalc && heroJourney && damageCalc && account && hub);

        assert.equal(buildBrandToolHref(oreCalc, 'en', '#8PJYGUJC'), '/ore-calculator/?tag=8PJYGUJC');
        assert.equal(buildBrandToolHref(heroJourney, 'de', 'ABC123'), '/de/hero-journey/?tag=ABC123');
        assert.equal(buildBrandToolHref(damageCalc, 'en', 'XYZ987'), '/damage-calculator/?tag=XYZ987');

        // Hub and Account must never append player tag
        assert.equal(buildBrandToolHref(account, 'en', '#8PJYGUJC'), '/account/');
        assert.equal(buildBrandToolHref(account, 'de', '8PJYGUJC'), '/de/account/');
        assert.equal(buildBrandToolHref(hub, 'en', '#8PJYGUJC'), '/');
    });
});

describe('Dynamic Route Exclusion & DOM Rendering', () => {
    /** @type {HTMLElement} */
    let container;

    beforeEach(() => {
        container = {
            innerHTML: '',
            querySelectorAll: () => []
        };
    });

    test('dynamically excludes active route and renders exactly 4 tools', () => {
        const routes = ['hub', 'ore-calculator', 'hero-journey', 'damage-calculator', 'account'];

        for (const activeRoute of routes) {
            renderBrandToolsDropdown(container, activeRoute, 'TAG123', 'en');

            assert.ok(!container.innerHTML.includes(`data-tool-id="${activeRoute}"`));

            const otherRoutes = routes.filter(r => r !== activeRoute);
            assert.equal(otherRoutes.length, 4);

            for (const other of otherRoutes) {
                assert.ok(
                    container.innerHTML.includes(`data-tool-id="${other}"`),
                    `Expected menu on ${activeRoute} to include ${other}`
                );
            }
        }
    });

    test('renders semantic accessibility attributes and vector SVG icons', () => {
        renderBrandToolsDropdown(container, 'hub', '', 'en');

        assert.ok(container.innerHTML.includes('role="menuitem"'));
        assert.ok(container.innerHTML.includes('tabindex="0"'), 'Dropdown items must define tabindex="0" for Safari navigation');
        assert.ok(container.innerHTML.includes('<clashcalc-assets-svg'));
        assert.ok(container.innerHTML.includes('brand-tools-dropdown__item-icon'));
        assert.ok(container.innerHTML.includes('brand-tools-dropdown__item-label'));
    });
});

describe('Brand Tools Dropdown State & Lifecycle', () => {
    test('closeBrandToolsDropdown safely handles missing elements without crashing', () => {
        assert.doesNotThrow(() => {
            closeBrandToolsDropdown(null);
        });
    });

    test('initBrandToolsDropdown safely handles missing containers without throwing', () => {
        assert.doesNotThrow(() => {
            const cleanup = initBrandToolsDropdown({ container: null });
            assert.equal(typeof cleanup, 'function');
            cleanup();
        });
    });

    test('toggleBrandToolsDropdown correctly toggles open and closed state', () => {
        const button = {
            setAttribute: (name, val) => { button[name] = val; },
            removeAttribute: (name) => { delete button[name]; },
            classList: {
                classes: new Set(),
                add(cls) { this.classes.add(cls); },
                remove(cls) { this.classes.delete(cls); },
                contains(cls) { return this.classes.has(cls); }
            },
            focus: () => {}
        };

        const menu = {
            hidden: true,
            innerHTML: '',
            classList: {
                classes: new Set(),
                add(cls) { this.classes.add(cls); },
                remove(cls) { this.classes.delete(cls); },
                contains(cls) { return this.classes.has(cls); }
            },
            querySelector: () => null,
            querySelectorAll: () => []
        };

        const wrapper = {
            querySelector: (sel) => {
                if (sel.includes('brand-tools-dropdown')) return menu;
                if (sel.includes('brand-page-pill')) return button;
                return null;
            }
        };

        // Initially closed
        assert.equal(menu.hidden, true);

        // Open
        toggleBrandToolsDropdown(wrapper, true);
        assert.equal(menu.hidden, false);
        assert.equal(menu.classList.contains('is-open'), true);
        assert.equal(button['aria-expanded'], 'true');
        assert.equal(button.classList.contains('is-active'), true);

        // Close
        toggleBrandToolsDropdown(wrapper, false);
        assert.equal(menu.hidden, true);
        assert.equal(menu.classList.contains('is-open'), false);
        assert.equal(button['aria-expanded'], 'false');
        assert.equal(button.classList.contains('is-active'), false);
    });
});
