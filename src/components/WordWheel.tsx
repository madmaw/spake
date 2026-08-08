import styles from "./WordWheel.module.css";
import { Line, Text, useCursor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { IconTrash } from "@tabler/icons-react";
import {
    type ReactNode,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
    useEffect,
    useRef,
    useState,
} from "react";
import { SpeechBubbleIcon } from "src/components/SpeechBubbleIcon";
import type { Group } from "three";

// how far a pointer must travel before a tap becomes a drag
const DRAG_THRESHOLD_PX = 10;
// how far a pointer must travel outside the ring to count as a swipe
const SWIPE_THRESHOLD_PX = 30;
const CAMERA_Z = 16;
const HALF_FOV_TAN = Math.tan((40 / 2) * (Math.PI / 180));

type WordWheelProps = {
    readonly onCapacityChange: (capacity: number) => void;
    readonly onDeleteLast: () => void;
    readonly onMore: (() => void) | null;
    readonly onNavigate: (word: string) => void;
    readonly onPushBack: (word: string) => void;
    readonly onReorder: (word: string, slot: number) => void;
    readonly onSelect: (word: string) => void;
    readonly onTrash: (word: string) => void;
    readonly previousWord: string | null;
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
    readonly isPrevious?: boolean;
    readonly position: readonly [number, number, number];
    readonly word: string;
};

type DragState =
    | {
          readonly dragging: boolean;
          readonly kind: "word";
          readonly startX: number;
          readonly startY: number;
          readonly word: string;
          readonly x: number;
          readonly y: number;
      }
    | {
          readonly kind: "swipe";
          readonly startX: number;
          readonly startY: number;
          readonly x: number;
          readonly y: number;
      };

type DropTarget = "more" | "trash";

type Pan = {
    pending: boolean;
    x: number;
    y: number;
};

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

function angularDifference(a: number, b: number): number {
    let difference = a - b;
    while (difference > Math.PI) {
        difference -= Math.PI * 2;
    }
    while (difference < -Math.PI) {
        difference += Math.PI * 2;
    }
    return Math.abs(difference);
}

/**
 * The previously chosen word takes over the ring slot in the direction the
 * cloud travelled from, so the path back is always visible on the wheel.
 */
function insertPreviousWord(
    placed: readonly PlacedWord[],
    previousWord: string | null,
    direction: readonly [number, number],
    scale: number,
): readonly PlacedWord[] {
    if (
        previousWord == null ||
        placed.length === 0 ||
        // completions can legitimately include the previous word; don't
        // shadow a real suggestion with a duplicate
        placed.some(
            (placedWord) =>
                placedWord.word.toLowerCase() === previousWord.toLowerCase(),
        )
    ) {
        return placed;
    }
    const targetAngle = Math.atan2(direction[1], direction[0]);
    let best = 0;
    let bestDifference = Number.POSITIVE_INFINITY;
    for (const [index, placedWord] of placed.entries()) {
        const difference = angularDifference(
            Math.atan2(placedWord.position[1], placedWord.position[0]),
            targetAngle,
        );
        if (difference < bestDifference) {
            bestDifference = difference;
            best = index;
        }
    }
    return placed.map((placedWord, index) =>
        index === best
            ? {
                  fontSize: scale * 0.036,
                  isPrevious: true,
                  position: placedWord.position,
                  word: previousWord,
              }
            : placedWord,
    );
}

/**
 * A 3D radial word cloud. The most likely words sit large on rings around the
 * centre, with a speech bubble in the middle to page through further
 * suggestions and the previously chosen word trailing behind on a line.
 *
 * A tap anywhere selects (and speaks) the nearest word; choosing a word
 * re-centres the cloud on where it was. Swiping from outside the ring
 * navigates to the word in that direction without speaking it. Words can be
 * dragged: onto the trash to remove them, onto the centre bubble to push them
 * back a page, or around the circle to reorder them. Tapping the trash
 * deletes the last word instead.
 */
export function WordWheel({
    onCapacityChange,
    onDeleteLast,
    onMore,
    onNavigate,
    onPushBack,
    onReorder,
    onSelect,
    onTrash,
    previousWord,
    words,
}: WordWheelProps) {
    const wheelRef = useRef<HTMLDivElement>(null);
    const moreRef = useRef<HTMLButtonElement>(null);
    const trashRef = useRef<HTMLButtonElement>(null);
    const panRef = useRef<Pan>({ pending: false, x: 0, y: 0 });
    const [size, setSize] = useState({ height: 0, width: 0 });
    const [drag, setDrag] = useState<DragState | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
    const [previousDirection, setPreviousDirection] = useState<
        readonly [number, number]
    >([-0.6, -0.5]);

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
    const scale = Math.min(viewport.width, viewport.height);
    const placed = insertPreviousWord(
        layoutWords(words, viewport.width, viewport.height, counts),
        previousWord,
        previousDirection,
        scale,
    );

    const toLocal = (clientX: number, clientY: number) => {
        const rect = wheelRef.current?.getBoundingClientRect();
        return rect == null
            ? { x: clientX, y: clientY }
            : { x: clientX - rect.left, y: clientY - rect.top };
    };

    const nearestSlot = (clientX: number, clientY: number): number | null => {
        if (size.height === 0) {
            return null;
        }
        const { x, y } = toLocal(clientX, clientY);
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

    /** The ring word whose direction from the centre best matches a vector. */
    const slotInDirection = (dx: number, dy: number): number | null => {
        // screen y points down, world y points up
        const angle = Math.atan2(-dy, dx);
        let best: number | null = null;
        let bestDifference = Number.POSITIVE_INFINITY;
        for (const [index, placedWord] of placed.entries()) {
            const wordAngle = Math.atan2(
                placedWord.position[1],
                placedWord.position[0],
            );
            const difference = angularDifference(wordAngle, angle);
            if (difference < bestDifference) {
                bestDifference = difference;
                best = index;
            }
        }
        return best;
    };

    /** Distance in px from the wheel centre to the outermost word. */
    const ringEdgePx = (): number => {
        let edge = 0;
        for (const placedWord of placed) {
            const px = projectToPx(
                placedWord.position,
                size.width,
                size.height,
            );
            edge = Math.max(
                edge,
                Math.hypot(px.x - size.width / 2, px.y - size.height / 2),
            );
        }
        return edge;
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

    /**
     * Choosing a word re-centres the cloud on where that word was: the pan
     * group jumps to its position and eases back to the origin, and the
     * previous-word marker trails behind in the direction travelled from.
     */
    const recentreOn = (position: readonly [number, number, number]) => {
        const [x, y] = position;
        panRef.current = { pending: true, x, y };
        const length = Math.hypot(x, y);
        if (length > 0.001) {
            setPreviousDirection([-x / length, -y / length]);
        }
    };

    const choose = (slot: number, speak: boolean) => {
        const placedWord = placed[slot];
        recentreOn(placedWord.position);
        if (placedWord.isPrevious === true) {
            // choosing the previous word travels back along the line
            onDeleteLast();
        } else if (speak) {
            onSelect(placedWord.word);
        } else {
            onNavigate(placedWord.word);
        }
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        // the more and trash buttons handle their own taps
        if (
            !(event.target instanceof Element) ||
            event.target.closest("button") != null
        ) {
            return;
        }
        // stop the tap from moving focus, which would blur the sentence field
        // and bounce the keyboard on mobile
        event.preventDefault();
        if (placed.length === 0) {
            return;
        }
        const local = toLocal(event.clientX, event.clientY);
        const fromCentre = Math.hypot(
            local.x - size.width / 2,
            local.y - size.height / 2,
        );
        wheelRef.current?.setPointerCapture(event.pointerId);
        if (fromCentre > ringEdgePx() + 20) {
            // outside the ring: a swipe navigates in that direction
            setDrag({
                kind: "swipe",
                startX: event.clientX,
                startY: event.clientY,
                x: event.clientX,
                y: event.clientY,
            });
            return;
        }
        const slot = nearestSlot(event.clientX, event.clientY);
        if (slot == null) {
            return;
        }
        setDrag({
            dragging: false,
            kind: "word",
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
        if (drag.kind === "swipe") {
            setDrag({ ...drag, x: event.clientX, y: event.clientY });
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

    const finishSwipe = (
        event: ReactPointerEvent<HTMLDivElement>,
        swipe: DragState & { kind: "swipe" },
    ) => {
        const dx = event.clientX - swipe.startX;
        const dy = event.clientY - swipe.startY;
        // a real swipe navigates without speaking; a plain tap still selects
        // (and speaks) the nearest word
        const swiped = Math.hypot(dx, dy) > SWIPE_THRESHOLD_PX;
        const slot = swiped
            ? slotInDirection(dx, dy)
            : nearestSlot(event.clientX, event.clientY);
        if (slot != null) {
            choose(slot, !swiped);
        }
    };

    const finishWordDrag = (
        event: ReactPointerEvent<HTMLDivElement>,
        wordDrag: DragState & { kind: "word" },
    ) => {
        if (!wordDrag.dragging) {
            const slot = placed.findIndex(
                (placedWord) => placedWord.word === wordDrag.word,
            );
            if (slot !== -1) {
                choose(slot, true);
            }
            return;
        }
        if (dropTarget === "trash") {
            onTrash(wordDrag.word);
            return;
        }
        if (dropTarget === "more") {
            onPushBack(wordDrag.word);
            return;
        }
        const slot = nearestSlot(event.clientX, event.clientY);
        if (slot != null) {
            onReorder(wordDrag.word, slot);
        }
    };

    const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (drag == null) {
            return;
        }
        if (drag.kind === "swipe") {
            finishSwipe(event, drag);
        } else {
            finishWordDrag(event, drag);
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
                    <PanGroup panRef={panRef}>
                        <Words
                            draggingWord={
                                drag?.kind === "word" && drag.dragging
                                    ? drag.word
                                    : null
                            }
                            placed={placed}
                        />
                    </PanGroup>
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
            <button
                aria-label="Delete the last word"
                className={styles.trash}
                data-active={dropTarget === "trash"}
                onClick={onDeleteLast}
                onPointerDown={(event) => event.preventDefault()}
                ref={trashRef}
                type="button"
            >
                <IconTrash aria-hidden size={24} />
            </button>
            {drag?.kind === "word" && drag.dragging && (
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

type PanGroupProps = {
    readonly children: ReactNode;
    readonly panRef: RefObject<Pan>;
};

/**
 * Jumps to the pending pan position (where the chosen word was) and eases
 * back to the origin, so the cloud appears to travel to the chosen word.
 */
function PanGroup({ children, panRef }: PanGroupProps) {
    const groupRef = useRef<Group>(null);
    useFrame((_, delta) => {
        const group = groupRef.current;
        if (group == null) {
            return;
        }
        if (panRef.current.pending) {
            group.position.set(panRef.current.x, panRef.current.y, 0);
            panRef.current.pending = false;
        }
        group.position.multiplyScalar(1 - Math.min(1, delta * 6));
    });
    return <group ref={groupRef}>{children}</group>;
}

type WordsProps = {
    readonly draggingWord: string | null;
    readonly placed: readonly PlacedWord[];
};

function Words({ draggingWord, placed }: WordsProps) {
    const previous = placed.find(
        (placedWord) => placedWord.isPrevious === true,
    );
    return (
        <group>
            {previous != null && (
                <Line
                    color="#4b5470"
                    lineWidth={1}
                    points={[
                        [0, 0, -0.6],
                        [
                            previous.position[0] * 0.82,
                            previous.position[1] * 0.82,
                            previous.position[2],
                        ],
                    ]}
                />
            )}
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

function wordColor(previous: boolean, highlighted: boolean): string {
    if (previous) {
        return "#8b93ab";
    }
    return highlighted ? "#ffd166" : "#e8ecf8";
}

function WordNode({ dimmed, placed }: WordNodeProps) {
    const groupRef = useRef<Group>(null);
    const appearProgressRef = useRef(0);
    const [hovered, setHovered] = useState(false);
    const previous = placed.isPrevious === true;
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
                color={wordColor(previous, hovered && !dimmed)}
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
