import styles from "./SentenceBar.module.css";
import {
    IconPlayerPlay,
    IconStar,
    IconStarFilled,
    IconX,
} from "@tabler/icons-react";
import { type PointerEvent, useEffect, useRef } from "react";

type SentenceBarProps = {
    readonly isFavourite: boolean;
    readonly onChangeText: (text: string) => void;
    readonly onClear: () => void;
    readonly onSpeak: () => void;
    readonly onToggleFavourite: () => void;
    readonly text: string;
};

// buttons normally take focus on pointer down, which would blur the sentence
// field and dismiss the keyboard on mobile
function keepInputFocus(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
}

/**
 * The sentence assembled so far, as an editable text field so words the wheel
 * doesn't offer can be typed. Tapped words are appended by the parent through
 * `onChangeText`.
 */
export function SentenceBar({
    isFavourite,
    onChangeText,
    onClear,
    onSpeak,
    onToggleFavourite,
    text,
}: SentenceBarProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const empty = text.trim().length === 0;
    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    // keep focus in the field so the keyboard stays visible on mobile
    const refocus = () => {
        requestAnimationFrame(() => inputRef.current?.focus());
    };
    return (
        <header className={styles.bar}>
            <button
                aria-label="Speak the whole sentence"
                className={styles.action}
                disabled={empty}
                onClick={onSpeak}
                onPointerDown={keepInputFocus}
                type="button"
            >
                <IconPlayerPlay aria-hidden size={24} />
            </button>
            <div className={styles.field}>
                <input
                    aria-label="Sentence"
                    autoComplete="off"
                    className={styles.sentence}
                    enterKeyHint="go"
                    onBlur={refocus}
                    onChange={(event) => onChangeText(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !empty) {
                            onSpeak();
                        }
                    }}
                    placeholder="Tap a word to speak it, or type"
                    ref={inputRef}
                    type="text"
                    value={text}
                />
                {text.length > 0 && (
                    <button
                        aria-label="Clear the sentence"
                        className={styles.clear}
                        onClick={onClear}
                        onPointerDown={keepInputFocus}
                        type="button"
                    >
                        <IconX aria-hidden size={18} />
                    </button>
                )}
            </div>
            <button
                aria-label={
                    isFavourite
                        ? "Remove from favourites"
                        : "Save to favourites"
                }
                aria-pressed={isFavourite}
                className={styles.action}
                data-active={isFavourite}
                disabled={empty}
                onClick={onToggleFavourite}
                onPointerDown={keepInputFocus}
                type="button"
            >
                {isFavourite ? (
                    <IconStarFilled aria-hidden size={24} />
                ) : (
                    <IconStar aria-hidden size={24} />
                )}
            </button>
        </header>
    );
}
