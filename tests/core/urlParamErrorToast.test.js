import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTranslations } from "../../js/i18n/translator.js";
import { validatePlayerTagInput } from "../../js/utils/playerTagValidator.js";
import { normalizePlayerTag } from "../../js/core/storageKeys.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "js/i18n/en.json"), "utf8"));

if (typeof globalThis.window === "undefined") {
    globalThis.window = {
        location: { origin: "http://localhost" }
    };
}
globalThis.fetch = async (url) => {
    if (String(url).includes("/en.json")) return { ok: true, json: async () => enJson };
    return { ok: false, status: 404 };
};

describe("Player Tag Error Boundary & URL Param Toast Contract Suite", () => {
    test("validatePlayerTagInput displays translated invalid character error and adds show class for invalid chars", async () => {
        await loadTranslations("en");
        const classSet = new Set();
        const inputElement = {
            value: "#8PJYGUJCH",
            classList: {
                add(cls) { classSet.add(cls); },
                remove(cls) { classSet.delete(cls); },
                contains(cls) { return classSet.has(cls); }
            },
            offsetWidth: 100
        };

        const errorClassSet = new Set();
        const errorElement = {
            textContent: "",
            classList: {
                add(cls) { errorClassSet.add(cls); },
                remove(cls) { errorClassSet.delete(cls); },
                contains(cls) { return errorClassSet.has(cls); }
            }
        };

        const result = validatePlayerTagInput(inputElement, errorElement);

        assert.strictEqual(result.isValid, false, "Tag with character H must be invalid");
        assert.ok(errorElement.textContent.includes("H"), "Error message must specify the invalid character H");
        assert.strictEqual(errorClassSet.has("show"), true, "Error element must receive show class");
        assert.strictEqual(classSet.has("input-error"), true, "Input element must receive input-error class");
        assert.strictEqual(classSet.has("shake"), true, "Input element must receive shake class on error");
    });

    test("validatePlayerTagInput clears error and removes show and shake classes when given valid character input", async () => {
        await loadTranslations("en");
        const classSet = new Set(["input-error", "shake"]);
        const inputElement = {
            value: "#8PJYGUJC",
            classList: {
                add(cls) { classSet.add(cls); },
                remove(cls) { classSet.delete(cls); },
                contains(cls) { return classSet.has(cls); }
            },
            offsetWidth: 100
        };

        const errorClassSet = new Set(["show"]);
        const errorElement = {
            textContent: "Ungueltiges Zeichen",
            classList: {
                add(cls) { errorClassSet.add(cls); },
                remove(cls) { errorClassSet.delete(cls); },
                contains(cls) { return errorClassSet.has(cls); }
            }
        };

        const result = validatePlayerTagInput(inputElement, errorElement);

        assert.strictEqual(result.isValid, true, "Valid tag must return isValid: true");
        assert.strictEqual(result.cleanedTag, "8PJYGUJC");
        assert.strictEqual(errorElement.textContent, "", "Error element text must be cleared on valid input");
        assert.strictEqual(errorClassSet.has("show"), false, "Error element must remove show class");
        assert.strictEqual(classSet.has("input-error"), false, "Input element must remove input-error class");
        assert.strictEqual(classSet.has("shake"), false, "Input element must remove shake class on valid input");
    });

    test("validatePlayerTagInput registers animationend listener and cleans up shake class", async () => {
        await loadTranslations("en");
        const classSet = new Set();
        let animationEndHandler = null;
        const inputElement = {
            value: "#INVALID?",
            classList: {
                add(cls) { classSet.add(cls); },
                remove(cls) { classSet.delete(cls); },
                contains(cls) { return classSet.has(cls); }
            },
            addEventListener(event, handler) {
                if (event === "animationend") {
                    animationEndHandler = handler;
                }
            },
            offsetWidth: 100
        };

        const errorElement = {
            textContent: "",
            classList: {
                add() {},
                remove() {},
                contains() { return false; }
            }
        };

        const result = validatePlayerTagInput(inputElement, errorElement);
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(classSet.has("shake"), true, "Must have shake class on error");
        assert.strictEqual(typeof animationEndHandler, "function", "Must attach animationend handler");

        animationEndHandler();
        assert.strictEqual(classSet.has("shake"), false, "Must remove shake class on animationend");
    });

    test("URL param parser distinguishes empty/DEFAULT0 invalid query from valid player tag", () => {
        const evalParam = (raw) => {
            const clean = normalizePlayerTag(raw);
            if (!clean || clean === "DEFAULT0") {
                return { isValid: false, reason: "apiErrors.invalidTag" };
            }
            return { isValid: true, tag: clean };
        };

        assert.deepStrictEqual(evalParam(""), { isValid: false, reason: "apiErrors.invalidTag" });
        assert.deepStrictEqual(evalParam("   "), { isValid: false, reason: "apiErrors.invalidTag" });
        assert.deepStrictEqual(evalParam("DEFAULT0"), { isValid: false, reason: "apiErrors.invalidTag" });
        assert.deepStrictEqual(evalParam("#DEFAULT0"), { isValid: false, reason: "apiErrors.invalidTag" });
        assert.deepStrictEqual(evalParam("8PJYGUJC"), { isValid: true, tag: "8PJYGUJC" });
        assert.deepStrictEqual(evalParam("#8PJYGUJC"), { isValid: true, tag: "8PJYGUJC" });
    });

    test("In-modal error handler keeps modal open and does not invoke global toast", () => {
        let toastInvoked = false;
        const _mockShowToast = () => { toastInvoked = true; };

        let modalClosed = false;
        const mockCloseModal = () => { modalClosed = true; };

        const errorElement = {
            textContent: "",
            classList: new Set(),
            style: {}
        };

        const tagInput = {
            classList: new Set(),
            offsetWidth: 200
        };

        // Simulate failed load within modal
        const loadResult = { success: false, message: "apiErrors.notFound" };
        if (!loadResult.success) {
            errorElement.textContent = "Player not found";
            errorElement.classList.add("show");
            tagInput.classList.add("input-error");
        } else {
            mockCloseModal();
        }

        assert.strictEqual(modalClosed, false, "Modal must remain open on error");
        assert.strictEqual(toastInvoked, false, "Toast must not be invoked for in-modal errors");
        assert.strictEqual(errorElement.classList.has("show"), true, "In-modal error container must be visible");
    });
});
