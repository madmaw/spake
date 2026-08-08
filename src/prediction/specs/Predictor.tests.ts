import { Predictor } from "src/prediction/Predictor";
import { beforeEach, describe, expect, it } from "vitest";

describe("Predictor", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("suggests sentence starters for an empty sentence", () => {
        const words = new Predictor().suggest([], 8);
        expect(words).toContain("I");
        expect(words).toHaveLength(8);
    });

    it("suggests likely continuations from bigram data", () => {
        expect(new Predictor().suggest(["I"], 10)).toContain("need");
        expect(new Predictor().suggest(["My"], 10)).toContain("throat");
    });

    it("suggests corpus continuations for words outside the curated data", () => {
        expect(new Predictor().suggest(["going"], 10)).toContain("to");
        expect(new Predictor().suggest(["really"], 10)).toContain("good");
    });

    it("ranks curated continuations ahead of corpus ones", () => {
        // curated: "need" -> water...; corpus would rank "to" first
        expect(new Predictor().suggest(["need"], 3)[0]).toBe("water");
    });

    it("pads suggestions with common words when bigrams run dry", () => {
        const words = new Predictor().suggest(["thank"], 10);
        expect(words[0]).toBe("you");
        expect(words).toHaveLength(10);
    });

    it("never repeats the previous word and never duplicates", () => {
        const words = new Predictor().suggest(["water"], 22);
        const lower = words.map((word) => word.toLowerCase());
        expect(lower).not.toContain("water");
        expect(new Set(lower).size).toBe(lower.length);
    });

    it("ranks learned words first", () => {
        const predictor = new Predictor();
        predictor.learn(["I"], "snorkel");
        expect(predictor.suggest(["I"], 5)[0]).toBe("snorkel");
    });

    it("persists learning across instances", () => {
        new Predictor().learn([], "Snorkel");
        expect(new Predictor().suggest([], 5)[0]).toBe("Snorkel");
    });

    it("completes prefixes from the vocabulary", () => {
        const completions = new Predictor().complete([], "wa", 20);
        expect(completions).toContain("water");
        expect(
            completions.every((word) => word.toLowerCase().startsWith("wa")),
        ).toBe(true);
    });

    it("ranks context-relevant completions first", () => {
        // curated continuations of "I" include "want"
        expect(new Predictor().complete(["I"], "w", 5)[0]).toBe("want");
    });

    it("falls back to the typed word for unknown prefixes", () => {
        expect(new Predictor().complete([], "xyzzy", 5)).toEqual(["xyzzy"]);
    });

    it("stops suggesting trashed words for that context", () => {
        const predictor = new Predictor();
        expect(predictor.suggest(["I"], 10)).toContain("need");
        predictor.block(["I"], "need");
        expect(predictor.suggest(["I"], 10)).not.toContain("need");
        // persists, and only applies to that context
        expect(new Predictor().suggest(["I"], 10)).not.toContain("need");
        expect(new Predictor().suggest(["you"], 200)).toContain("need");
    });

    it("stops completing trashed words for that context", () => {
        const predictor = new Predictor();
        predictor.block(["some"], "water");
        expect(predictor.complete(["some"], "wat", 10)).not.toContain("water");
    });

    it("pins reordered words to their new position", () => {
        const predictor = new Predictor();
        predictor.pin(["I"], "love", 0);
        expect(predictor.suggest(["I"], 10)[0]).toBe("love");
        expect(new Predictor().suggest(["I"], 10)[0]).toBe("love");
    });

    it("pushes words back by pinning them at a later index", () => {
        const predictor = new Predictor();
        predictor.pin([], "I", 30);
        const suggestions = predictor.suggest([], 40);
        expect(suggestions[30]).toBe("I");
    });

    it("adds learned words to the completion lexicon", () => {
        const predictor = new Predictor();
        predictor.learn(["some"], "paracetamol");
        expect(predictor.complete([], "para", 10)).toContain("paracetamol");
        // and to the suggestion pool
        expect(predictor.suggest(["some"], 5)[0]).toBe("paracetamol");
    });
});
