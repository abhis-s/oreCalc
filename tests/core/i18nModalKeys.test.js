import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

function resolveKey(obj, keyPath) {
    return keyPath.split('.').reduce((curr, seg) => (curr && typeof curr === 'object' ? curr[seg] : undefined), obj);
}

function getFilesRecursively(dir, filterFn) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!['node_modules', 'dist', 'scratch', '.git'].includes(entry.name)) {
                results.push(...getFilesRecursively(fullPath, filterFn));
            }
        } else if (filterFn(fullPath)) {
            results.push(fullPath);
        }
    }
    return results;
}

describe('Modal & Dialog i18n Key Integrity', () => {
    const enPath = path.join(projectRoot, 'js/i18n/en.json');
    const dePath = path.join(projectRoot, 'js/i18n/de.json');
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const de = JSON.parse(fs.readFileSync(dePath, 'utf8'));

    it('defines all canonical default keys used by noticeModal.js', () => {
        const defaultNoticeKeys = [
            'actions.confirm',
            'actions.cancel',
            'status.notice',
            'status.error',
            'actions.clear',
            'actions.reset',
            'actions.delete',
            'actions.loadAnyway'
        ];

        for (const key of defaultNoticeKeys) {
            const enVal = resolveKey(en, key);
            const deVal = resolveKey(de, key);
            assert.ok(typeof enVal === 'string' && enVal.length > 0, `en.json must define notice modal key "${key}"`);
            assert.ok(typeof deVal === 'string' && deVal.length > 0, `de.json must define notice modal key "${key}"`);
        }
    });

    it('verifies that all showConfirm, showAlert, and showNotice call sites use valid translation keys', () => {
        const jsFiles = getFilesRecursively(path.join(projectRoot, 'js'), f => f.endsWith('.js'));
        const modalRegex = /\b(showConfirm|showAlert|showNotice)\s*\(([^;]+?)\);/gs;
        const namespaceKeyRegex = /['"]((?:actions|alerts|apiErrors|app|auth|colors|confirms|entities|errors|legal|nav|player|status|time|validation|views)\.[a-zA-Z0-9_.-]+)['"]/g;

        const referencedModalKeys = new Set();
        let totalCalls = 0;

        for (const file of jsFiles) {
            const content = fs.readFileSync(file, 'utf8');
            for (const match of content.matchAll(modalRegex)) {
                totalCalls++;
                const args = match[2];
                for (const km of args.matchAll(namespaceKeyRegex)) {
                    referencedModalKeys.add(km[1]);
                }
            }
        }

        assert.ok(totalCalls > 0, 'Codebase should have at least one modal call');
        assert.ok(referencedModalKeys.size > 0, 'Should extract modal translation keys');

        const missingInEn = [];
        const missingInDe = [];

        for (const key of referencedModalKeys) {
            const enVal = resolveKey(en, key);
            const deVal = resolveKey(de, key);
            if (typeof enVal !== 'string') missingInEn.push(key);
            if (typeof deVal !== 'string') missingInDe.push(key);
        }

        assert.deepEqual(missingInEn, [], `Modal calls reference keys missing from en.json: ${missingInEn.join(', ')}`);
        assert.deepEqual(missingInDe, [], `Modal calls reference keys missing from de.json: ${missingInDe.join(', ')}`);
    });

    it('ensures safeTranslate has been completely decommissioned across production code', () => {
        const jsFiles = getFilesRecursively(path.join(projectRoot, 'js'), f => f.endsWith('.js'));
        const safeTranslateViolations = [];

        for (const file of jsFiles) {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes('safeTranslate')) {
                safeTranslateViolations.push(path.relative(projectRoot, file));
            }
        }

        assert.deepEqual(safeTranslateViolations, [], `safeTranslate must not exist in production JS modules: ${safeTranslateViolations.join(', ')}`);
    });
});
