import styles from "./WordWheel.module.css";
import { Text, useCursor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { IconTrash } from "@tabler/icons-react";
import {
    type PointerEvent as ReactPointerEvent,
    useEffect,
    useRef,
    useState,
} from "react";
import { SpeechBubbleIcon } from "src/components/SpeechBubbleIcon";
import type { Group } from "three";

// how far a pointer must travel before a tap becomes a drag
const DRAG_THRESHOLD_PX = 10;
const CAMERA_Z = 16;
const HALF_FOV_TAN = Math.tan((40 / 2) * (Math.PI / 180));

type WordWheelProps = {
    readonly onCapacityChange: (capacity: number) => void;
    readonly onMore: (() => void) | null;
    readonly onPushBack: (word: string) => void;
    readonly onReorder: (word: string, slot: number) => void;
    readonly onSelect: (word: string) => void;
    readonly onTrash: (word: string) => void;
    readonly words: readonly string[];
};

type RingCounts = {
    readonly inner: number;
    readonly outer: number;
};

/**
 * How many words fit on the wheel, based on the measured space available —
 * small screens get a single ring rather than a cramped pair.
 */
function ringCounts(width: number, height: number): RingCounts {
    const min = Math.min(width, height);
    if (min < 360) {
        return { inner: 6, outer: 0 };
    }
    if (min < 520) {
        return { inner: 8, outer: 0 };
    }
    if (min < 680) {
        return { inner: 8, outer: 10 };
    }
    return { inner: 8, outer: 14 };
}

type PlacedWord = {
    readonly fontSize: number;
    readonly position: readonly [number, number, number];
    readonly word: string;
};

type DragState = {
    readonly dragging: boolean;
    readonly startX: number;
    readonly startY: number;
    readonly word: string;
    readonly x: number;
    readonly y: number;
};

type DropTarget = "more" | "trash";

/** World-unit size of the camera frustum at z=0 for a given canvas size. */
function viewportAt(canvasWidth: number, canvasHeight: number) {
    const height = 2 * CAMERA_Z * HALF_FOV_TAN;
    return {
        height,
        width: canvasHeight === 0 ? 0 : (height * canvasWidth) / canvasHeight,
    };
}

/** Perspective-project a world position to canvas pixel coordinates. */
function projectToPx(
    position: readonly [number, number, number],
    canvasWidth: number,
    canvasHeight: number,
): { x: number; y: number } {
    const [x, y, z] = position;
    const halfHeight = (CAMERA_Z - z) * HALF_FOV_TAN;
    const halfWidth = (halfHeight * canvasWidth) / canvasHeight;
    return {
        x: (x / halfWidth + 1) * 0.5 * canvasWidth,
        y: (1 - y / halfHeight) * 0.5 * canvasHeight,
    };
}

type Ring = {
    readonly angleOffset: number;
    readonly fontScale: number;
    readonly radius: number;
};

function placeRing(
    ring: readonly string[],
    { angleOffset, fontScale, radius }: Ring,
    startRank: number,
    scale: number,
): readonly PlacedWord[] {
    return ring.map((word, index) => {
        // start at the top (+y) so the most likely word is the most prominent
        const angle =
            Math.PI / 2 - angleOffset - (index * Math.PI * 2) / ring.length;
        const rank = startRank + index;
        return {
            fontSize:
                fontScale *
                Math.max(scale * 0.034, scale * 0.06 * (1 - rank * 0.028)),
            // deterministic pseudo-random depth so the cloud feels 3D but
            // words never move out from under a hovering finger
            position: [
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                -1 + Math.sin((rank + 1) * 12.9898) * 0.7,
            ] as const,
            word,
        };
    });
}

// rings are true circles sized by the smaller dimension, so the wider
// dimension leaves margin rather than stretching the ring into an ellipse
function layoutWords(
    words: readonly string[],
    width: number,
    height: number,
    counts: RingCounts,
): readonly PlacedWord[] {
    const scale = Math.min(width, height);
    const inner = words.slice(0, counts.inner);
    const outer = words.slice(counts.inner);
    if (outer.length === 0) {
        // a single ring gets more room and larger words
        return placeRing(
            inner,
            { angleOffset: 0, fontScale: 1.2, radius: scale * 0.36 },
            0,
            scale,
        );
    }
    return [
        ...placeRing(
            inner,
            { angleOffset: 0, fontScale: 1, radius: scale * 0.24 },
            0,
            scale,
        ),
        ...placeRing(
            outer,
            {
                angleOffset: Math.PI / outer.length,
                fontScale: 1,
                radius: scale * 0.44,
            },
            counts.inner,
            scale,
        ),
    ];
}

/**
 * A 3D radial word cloud. The most likely words sit large on an inner ring,
 * the rest on an outer ring, with a button in the centre to page through
 * further suggestions.
 *
 * A tap anywhere selects the nearest word, so misses still land. Words can
 * also be dragged: onto the trash to remove them, onto the centre button to
 * push them back a page, or around the circle to reorder them.
 */
export function WordWheel({
    onCapacityChange,
    onMore,
    onPushBack,
    onReorder,
    onSelect,
    onTrash,
    words,
}: WordWheelProps) {
    const wheelRef = useRef<HTMLDivElement>(null);
    const moreRef = useRef<HTMLButtonElement>(null);
    const trashRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ height: 0, width: 0 });
    const [drag, setDrag] = useState<DragState | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

    useEffect(() => {
        const wheel = wheelRef.current;
        if (wheel == null) {
            return;
        }
        // ResizeObserver delivers an initial notification on observe()
        const observer = new ResizeObserver(() => {
            setSize({ height: wheel.clientHeight, width: wheel.clientWidth });
        });
        observer.observe(wheel);
        return () => observer.disconnect();
    }, []);

    const counts = ringCounts(size.width, size.height);
    const capacity = size.height === 0 ? null : counts.inner + counts.outer;
    useEffect(() => {
        if (capacity != null) {
            onCapacityChange(capacity);
        }
    }, [capacity, onCapacityChange]);

    const viewport = viewportAt(size.width, size.height);
    const placed = layoutWords(words, viewport.width, viewport.height, counts);

    const nearestSlot = (clientX: number, clientY: number): number | null => {
        const wheel = wheelRef.current;
        if (wheel == null || size.height === 0) {
            return null;
        }
        const rect = wheel.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        let best: number | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const [index, placedWord] of placed.entries()) {
            const px = projectToPx(
                placedWord.position,
                size.width,
                size.height,
            );
            const distance = (px.x - x) ** 2 + (px.y - y) ** 2;
            if (distance < bestDistance) {
                bestDistance = distance;
                best = index;
            }
        }
        return best;
    };

    const hitTarget = (clientX: number, clientY: number): DropTarget | null => {
        const within = (element: HTMLElement | null) => {
            if (element == null) {
                return false;
            }
            const rect = element.getBoundingClientRect();
            return (
                clientX >= rect.left &&
                clientX <= rect.right &&
                clientY >= rect.top &&
                clientY <= rect.bottom
            );
        };
        if (within(trashRef.current)) {
            return "trash";
        }
        if (within(moreRef.current)) {
            return "more";
        }
        return null;
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        // let the more button handle its own taps, and don't treat a tap on
        // the trash as a word selection
        if (
            !(event.target instanceof Element) ||
            event.target.closest("button") != null ||
            trashRef.current?.contains(event.target) === true
        ) {
            return;
        }
        // stop the tap from moving focus, which would blur the sentence field
        // and bounce the keyboard on mobile
        event.preventDefault();
        const slot = nearestSlot(event.clientX, event.clientY);
        if (slot == null) {
            return;
        }
        wheelRef.current?.setPointerCapture(event.pointerId);
        setDrag({
            dragging: false,
            startX: event.clientX,
            startY: event.clientY,
            word: placed[slot].word,
            x: event.clientX,
            y: event.clientY,
        });
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (drag == null) {
            return;
        }
        const dragging =
            drag.dragging ||
            Math.hypot(
                event.clientX - drag.startX,
                event.clientY - drag.startY,
            ) > DRAG_THRESHOLD_PX;
        setDrag({
            ...drag,
            dragging,
            x: event.clientX,
            y: event.clientY,
        });
        setDropTarget(
            dragging ? hitTarget(event.clientX, event.clientY) : null,
        );
    };

    const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (drag == null) {
            return;
        }
        if (!drag.dragging) {
            onSelect(drag.word);
        } else if (dropTarget === "trash") {
            onTrash(drag.word);
        } else if (dropTarget === "more") {
            onPushBack(drag.word);
        } else {
            const slot = nearestSlot(event.clientX, event.clientY);
            if (slot != null) {
                onReorder(drag.word, slot);
            }
        }
        setDrag(null);
        setDropTarget(null);
    };

    const cancelDrag = () => {
        setDrag(null);
        setDropTarget(null);
    };

    return (
        <div
            className={styles.wheel}
            onPointerCancel={cancelDrag}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            ref={wheelRef}
        >
            {size.height > 0 && (
                <Canvas camera={{ fov: 40, position: [0, 0, CAMERA_Z] }}>
                    <Words
                        draggingWord={
                            drag?.dragging === true ? drag.word : null
                        }
                        placed={placed}
                    />
                </Canvas>
            )}
            {onMore != null && (
                <button
                    aria-label="More words"
                    className={styles.more}
                    data-active={dropTarget === "more"}
                    onClick={onMore}
                    onPointerDown={(event) => event.preventDefault()}
                    ref={moreRef}
                    type="button"
                >
                    <SpeechBubbleIcon size={52} />
                </button>
            )}
            <div
                aria-hidden
                className={styles.trash}
                data-active={dropTarget === "trash"}
                ref={trashRef}
            >
                <IconTrash size={24} />
            </div>
            {drag?.dragging === true && (
                <div
                    className={styles.ghost}
                    style={{ left: drag.x, top: drag.y }}
                >
                    {drag.word}
                </div>
            )}
        </div>
    );
}

type WordsProps = {
    readonly draggingWord: string | null;
    readonly placed: readonly PlacedWord[];
};

function Words({ draggingWord, placed }: WordsProps) {
    return (
        <group>
            {placed.map((placedWord) => (
                <WordNode
                    dimmed={placedWord.word === draggingWord}
                    key={placedWord.word}
                    placed={placedWord}
                />
            ))}
        </group>
    );
}

type WordNodeProps = {
    readonly dimmed: boolean;
    readonly placed: PlacedWord;
};

function WordNode({ dimmed, placed }: WordNodeProps) {
    const groupRef = useRef<Group>(null);
    const appearProgressRef = useRef(0);
    const [hovered, setHovered] = useState(false);
    useCursor(hovered);
    useFrame((state, delta) => {
        const group = groupRef.current;
        if (group == null) {
            return;
        }
        appearProgressRef.current = Math.min(
            1,
            appearProgressRef.current + delta * 2.5,
        );
        const eased = 1 - (1 - appearProgressRef.current) ** 3;
        const target = eased * (hovered && !dimmed ? 1.18 : 1);
        group.scale.setScalar(
            group.scale.x + (target - group.scale.x) * Math.min(1, delta * 12),
        );
        const [x, y, z] = placed.position;
        group.position.set(
            x,
            y + Math.sin(state.clock.elapsedTime * 0.8 + z * 5) * 0.05,
            z,
        );
    });
    return (
        <group position={[...placed.position]} ref={groupRef} scale={0}>
            <Text
                anchorX="center"
                anchorY="middle"
                color={hovered && !dimmed ? "#ffd166" : "#e8ecf8"}
                fillOpacity={dimmed ? 0.2 : 1}
                fontSize={placed.fontSize}
                onPointerOut={() => setHovered(false)}
                onPointerOver={() => setHovered(true)}
            >
                {placed.word}
            </Text>
        </group>
    );
}
