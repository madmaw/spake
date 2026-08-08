import styles from "./FavouritesPanel.module.css";
import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import type { Favourite } from "src/favourites/useFavourites";
import {
    getSpeechSettings,
    type SpeechSettings,
    setSpeechSettings,
    speakPhrase,
    useVoices,
} from "src/speech/speech";

type FavouritesPanelProps = {
    readonly favourites: readonly Favourite[];
    readonly onRemove: (id: string) => void;
};

/**
 * Saved phrases that can be spoken with a single tap, plus voice settings.
 */
export function FavouritesPanel({
    favourites,
    onRemove,
}: FavouritesPanelProps) {
    const voices = useVoices();
    const [settings, setSettings] = useState(getSpeechSettings);
    const updateSettings = (next: SpeechSettings) => {
        setSettings(next);
        setSpeechSettings(next);
    };
    return (
        <div className={styles.panel}>
            <ul className={styles.list}>
                {favourites.map((favourite) => (
                    <li className={styles.item} key={favourite.id}>
                        <button
                            className={styles.phrase}
                            onClick={() => speakPhrase(favourite.text)}
                            type="button"
                        >
                            {favourite.text}
                        </button>
                        <button
                            aria-label={`Delete "${favourite.text}"`}
                            className={styles.delete}
                            onClick={() => onRemove(favourite.id)}
                            type="button"
                        >
                            <IconX aria-hidden size={20} />
                        </button>
                    </li>
                ))}
            </ul>
            <div className={styles.settings}>
                <label className={styles.setting}>
                    Voice
                    <select
                        onChange={(event) =>
                            updateSettings({
                                ...settings,
                                voiceName:
                                    event.target.value === ""
                                        ? null
                                        : event.target.value,
                            })
                        }
                        value={settings.voiceName ?? ""}
                    >
                        <option value="">Default</option>
                        {voices.map((voice) => (
                            <option key={voice.name} value={voice.name}>
                                {voice.name} ({voice.lang})
                            </option>
                        ))}
                    </select>
                </label>
                <label className={styles.setting}>
                    Speed
                    <input
                        max={1.5}
                        min={0.5}
                        onChange={(event) =>
                            updateSettings({
                                ...settings,
                                rate: Number(event.target.value),
                            })
                        }
                        step={0.1}
                        type="range"
                        value={settings.rate}
                    />
                </label>
            </div>
        </div>
    );
}
