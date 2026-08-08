import { useEffect, useState } from "react";
import { readJson, writeJson } from "src/utils/storage";

const SETTINGS_KEY = "words.speech-settings";

export type SpeechSettings = {
    readonly rate: number;
    readonly voiceName: string | null;
};

const DEFAULT_SETTINGS: SpeechSettings = {
    rate: 1,
    voiceName: null,
};

let currentSettings: SpeechSettings | null = null;

export function getSpeechSettings(): SpeechSettings {
    currentSettings ??=
        readJson<SpeechSettings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
    return currentSettings;
}

export function setSpeechSettings(settings: SpeechSettings): void {
    currentSettings = settings;
    writeJson(SETTINGS_KEY, settings);
}

function isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
}

function createUtterance(text: string): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(text);
    const { rate, voiceName } = getSpeechSettings();
    utterance.rate = rate;
    if (voiceName != null) {
        const voice = speechSynthesis
            .getVoices()
            .find((candidate) => candidate.name === voiceName);
        if (voice != null) {
            utterance.voice = voice;
        }
    }
    return utterance;
}

// Chrome garbage collects utterances that are still being spoken, silencing
// them mid-speech, unless we keep a reference until they finish
const pendingUtterances = new Set<SpeechSynthesisUtterance>();

function speak(text: string, interrupt: boolean): void {
    if (!isSupported()) {
        return;
    }
    if (interrupt) {
        speechSynthesis.cancel();
    }
    const utterance = createUtterance(text);
    pendingUtterances.add(utterance);
    utterance.addEventListener("end", () => {
        pendingUtterances.delete(utterance);
    });
    utterance.addEventListener("error", (event) => {
        console.warn(`speech failed for "${text}": ${event.error}`);
        pendingUtterances.delete(utterance);
    });
    // Chrome can wedge itself in a paused state (e.g. after a cancel) where
    // speak() is silently swallowed; resume() is a no-op when not paused
    speechSynthesis.resume();
    speechSynthesis.speak(utterance);
}

/**
 * Warm up the speech engine. Chrome loads voices lazily and can drop the
 * first utterance if it is spoken before any voices are available.
 */
export function initSpeech(): void {
    if (!isSupported()) {
        return;
    }
    speechSynthesis.getVoices();
}

/**
 * Speak a single word. Queued behind anything already being spoken so quickly
 * chained words all get heard. Lower-cased because some voices read a lone
 * capitalised word as "Capital I".
 */
export function speakWord(word: string): void {
    speak(word.toLowerCase(), false);
}

/**
 * Speak a whole phrase, interrupting anything already being spoken.
 */
export function speakPhrase(phrase: string): void {
    speak(phrase, true);
}

/**
 * The available speech synthesis voices. Loads asynchronously in most browsers.
 */
export function useVoices(): readonly SpeechSynthesisVoice[] {
    const [voices, setVoices] = useState<readonly SpeechSynthesisVoice[]>(() =>
        isSupported() ? speechSynthesis.getVoices() : [],
    );
    useEffect(() => {
        if (!isSupported()) {
            return;
        }
        const update = () => setVoices(speechSynthesis.getVoices());
        speechSynthesis.addEventListener("voiceschanged", update);
        return () =>
            speechSynthesis.removeEventListener("voiceschanged", update);
    }, []);
    return voices;
}
