import styles from "./ViewMenu.module.css";
import { IconMenu2, IconMessageCircle, IconStar } from "@tabler/icons-react";
import { type PointerEvent, useState } from "react";

export type Tab = "favourites" | "speak";

type ViewMenuProps = {
    readonly onChange: (tab: Tab) => void;
    readonly tab: Tab;
};

// keep focus in the sentence field so the keyboard doesn't bounce on mobile
function keepInputFocus(event: PointerEvent<HTMLElement>) {
    event.preventDefault();
}

/**
 * A floating hamburger menu for switching between the speaking wheel and the
 * favourites list.
 */
export function ViewMenu({ onChange, tab }: ViewMenuProps) {
    const [open, setOpen] = useState(false);
    const choose = (next: Tab) => {
        onChange(next);
        setOpen(false);
    };
    return (
        <div className={styles.menu}>
            {open && (
                <>
                    <div
                        className={styles.backdrop}
                        onPointerDown={(event) => {
                            keepInputFocus(event);
                            setOpen(false);
                        }}
                    />
                    <div className={styles.items} role="menu">
                        <button
                            className={styles.item}
                            data-active={tab === "speak"}
                            onClick={() => choose("speak")}
                            onPointerDown={keepInputFocus}
                            role="menuitem"
                            type="button"
                        >
                            <IconMessageCircle aria-hidden size={20} />
                            Speak
                        </button>
                        <button
                            className={styles.item}
                            data-active={tab === "favourites"}
                            onClick={() => choose("favourites")}
                            onPointerDown={keepInputFocus}
                            role="menuitem"
                            type="button"
                        >
                            <IconStar aria-hidden size={20} />
                            Favourites
                        </button>
                    </div>
                </>
            )}
            <button
                aria-expanded={open}
                aria-label="Menu"
                className={styles.trigger}
                onClick={() => setOpen(!open)}
                onPointerDown={keepInputFocus}
                type="button"
            >
                <IconMenu2 aria-hidden size={24} />
            </button>
        </div>
    );
}
