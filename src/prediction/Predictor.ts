import { readJson, writeJson } from "src/utils/storage";
import {
    GENERATED_BIGRAMS,
    GENERATED_COMMON,
    GENERATED_VOCAB,
} from "./bigrams.generated";
import { COMMON_WORDS, NEXT_WORDS, SENTENCE_STARTERS } from "./data";

const LEARNED_BIGRAMS_KEY = "words.learned-bigrams";
const LEARNED_WORDS_KEY = "words.learned-words";
const PINNED_KEY = "words.pinned-bigrams";
const BLOCKED_KEY = "words.blocked-bigrams";
const START_KEY = "^";

type StoredBigrams = readonly (readonly [
    string,
    readonly (readonly [string, number])[],
])[];

type StoredWords = readonly (readonly [string, number])[];

type StoredBlocked = readonly (readonly [string, readonly string[]])[];

function normalize(word: string): string {
    return word.trim().toLowerCase();
}

function contextKey(sentence: readonly string[]): string {
    const last = sentence.at(-1);
    return last == null ? START_KEY : normalize(last);
}

function byCountDescending(
    [, a]: readonly [string, number],
    [, b]: readonly [string, number],
): number {
    return b - a;
}

/**
 * Suggests the most likely next words for a sentence in progress, and prefix
 * completions for a word being typed. Bigrams and words learned from the
 * user's own sentences rank first, then curated bigram data, then bigrams and
 * vocabulary from a general-English corpus.
 */
export class Predictor {
    private readonly learnedBigrams = new Map<string, Map<string, number>>();
    private readonly learnedWords = new Map<string, number>();
    private readonly pinned = new Map<string, Map<string, number>>();
    private readonly blocked = new Map<string, Set<string>>();

    constructor() {
        const storedBigrams =
            readJson<StoredBigrams>(LEARNED_BIGRAMS_KEY) ?? [];
        for (const [key, counts] of storedBigrams) {
            this.learnedBigrams.set(key, new Map(counts));
        }
        const storedWords = readJson<StoredWords>(LEARNED_WORDS_KEY) ?? [];
        for (const [word, count] of storedWords) {
            this.learnedWords.set(word, count);
        }
        const storedPins = readJson<StoredBigrams>(PINNED_KEY) ?? [];
        for (const [key, pins] of storedPins) {
            this.pinned.set(key, new Map(pins));
        }
        const storedBlocked = readJson<StoredBlocked>(BLOCKED_KEY) ?? [];
        for (const [key, blockedWords] of storedBlocked) {
            this.blocked.set(key, new Set(blockedWords));
        }
    }

    suggest(sentence: readonly string[], count: number): string[] {
        const key = contextKey(sentence);
        const candidates = this.contextCandidates(key);
        if (key === START_KEY) {
            candidates.push(...SENTENCE_STARTERS);
        }
        candidates.push(...COMMON_WORDS);
        candidates.push(...this.rankedLearnedWords());
        candidates.push(...GENERATED_COMMON);
        // don't suggest the word that was just chosen, nor trashed words
        const excluded = new Set([key, ...(this.blocked.get(key) ?? [])]);
        return this.applyPins(key, dedupe(candidates, excluded, count)).slice(
            0,
            count,
        );
    }

    /**
     * Words starting with the (possibly partial) word being typed.
     * Context-relevant words rank first, then the user's own words, then
     * general vocabulary by frequency. Falls back to the typed word itself so
     * new words can still be tapped and spoken.
     */
    complete(
        sentence: readonly string[],
        prefix: string,
        count: number,
    ): string[] {
        const normalizedPrefix = normalize(prefix);
        const key = contextKey(sentence);
        const candidates = [
            ...this.contextCandidates(key),
            ...this.rankedLearnedWords(),
            ...COMMON_WORDS,
            ...GENERATED_COMMON,
            ...GENERATED_VOCAB,
        ].filter((word) => normalize(word).startsWith(normalizedPrefix));
        const excluded = new Set(this.blocked.get(key) ?? []);
        const completions = dedupe(candidates, excluded, count);
        return completions.length === 0 ? [prefix] : completions;
    }

    /**
     * Never suggest `word` after this context again (the user dragged it to
     * the trash).
     */
    block(sentence: readonly string[], word: string): void {
        const key = contextKey(sentence);
        let blockedWords = this.blocked.get(key);
        if (blockedWords == null) {
            blockedWords = new Set();
            this.blocked.set(key, blockedWords);
        }
        blockedWords.add(normalize(word));
        this.pinned.get(key)?.delete(word);
        this.persistCuration();
    }

    /**
     * Always show `word` at `index` in this context's suggestions (the user
     * dragged it to a new position).
     */
    pin(sentence: readonly string[], word: string, index: number): void {
        const key = contextKey(sentence);
        let pins = this.pinned.get(key);
        if (pins == null) {
            pins = new Map();
            this.pinned.set(key, pins);
        }
        pins.set(word, index);
        this.blocked.get(key)?.delete(normalize(word));
        this.persistCuration();
    }

    learn(sentence: readonly string[], chosen: string): void {
        const key = contextKey(sentence);
        let next = this.learnedBigrams.get(key);
        if (next == null) {
            next = new Map();
            this.learnedBigrams.set(key, next);
        }
        next.set(chosen, (next.get(chosen) ?? 0) + 1);
        const storedBigrams: StoredBigrams = [
            ...this.learnedBigrams.entries(),
        ].map(([context, counts]) => [context, [...counts.entries()]]);
        writeJson(LEARNED_BIGRAMS_KEY, storedBigrams);

        this.learnedWords.set(chosen, (this.learnedWords.get(chosen) ?? 0) + 1);
        writeJson(LEARNED_WORDS_KEY, [...this.learnedWords.entries()]);
    }

    private contextCandidates(key: string): string[] {
        const candidates: string[] = [];
        const learnedNext = this.learnedBigrams.get(key);
        if (learnedNext != null) {
            candidates.push(
                ...[...learnedNext.entries()]
                    .sort(byCountDescending)
                    .map(([word]) => word),
            );
        }
        // curated bigrams are tailored to this app, so they outrank the
        // general-English corpus bigrams
        candidates.push(...(NEXT_WORDS.get(key) ?? []));
        candidates.push(...(GENERATED_BIGRAMS[key] ?? []));
        return candidates;
    }

    private rankedLearnedWords(): string[] {
        return [...this.learnedWords.entries()]
            .sort(byCountDescending)
            .map(([word]) => word);
    }

    private applyPins(key: string, list: string[]): string[] {
        const pins = this.pinned.get(key);
        if (pins == null || pins.size === 0) {
            return list;
        }
        const pinEntries = [...pins.entries()].sort(([, a], [, b]) => a - b);
        const pinnedWords = new Set(
            pinEntries.map(([word]) => normalize(word)),
        );
        const result = list.filter((word) => !pinnedWords.has(normalize(word)));
        for (const [word, index] of pinEntries) {
            result.splice(Math.min(index, result.length), 0, word);
        }
        return result;
    }

    private persistCuration(): void {
        const storedPins: StoredBigrams = [...this.pinned.entries()].map(
            ([context, pins]) => [context, [...pins.entries()]],
        );
        writeJson(PINNED_KEY, storedPins);
        const storedBlocked: StoredBlocked = [...this.blocked.entries()].map(
            ([context, blockedWords]) => [context, [...blockedWords]],
        );
        writeJson(BLOCKED_KEY, storedBlocked);
    }
}

function dedupe(
    candidates: readonly string[],
    excluded: ReadonlySet<string>,
    count: number,
): string[] {
    const seen = new Set(excluded);
    const words: string[] = [];
    for (const word of candidates) {
        const normalized = normalize(word);
        if (seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        words.push(word);
        if (words.length >= count) {
            break;
        }
    }
    return words;
}
