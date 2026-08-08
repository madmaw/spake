type SpeechBubbleIconProps = {
    readonly size: number;
};

/**
 * The app's motif: a gold speech bubble with three "typing" dots. Keep in
 * sync with the PWA icons drawn by scripts/build-icons.mjs.
 */
export function SpeechBubbleIcon({ size }: SpeechBubbleIconProps) {
    return (
        <svg
            aria-hidden
            fill="none"
            height={size}
            viewBox="0 0 48 48"
            width={size}
        >
            <rect fill="#ffd166" height="32" rx="16" width="42" x="3" y="3" />
            <path d="M13 30 L8 45 L27 33 Z" fill="#ffd166" />
            <circle cx="15" cy="19" fill="#0b0e17" r="3.4" />
            <circle cx="24" cy="19" fill="#0b0e17" r="3.4" />
            <circle cx="33" cy="19" fill="#0b0e17" r="3.4" />
        </svg>
    );
}
