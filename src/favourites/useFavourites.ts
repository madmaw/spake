import { useState } from "react";
import { readJson, writeJson } from "src/utils/storage";

const FAVOURITES_KEY = "words.favourites";

export type Favourite = {
    readonly id: string;
    readonly text: string;
};

const DEFAULT_FAVOURITES: readonly Favourite[] = [
    "Yes",
    "No",
    "Thank you",
    "I've lost my voice",
    "I need help please",
    "Can I have some water?",
    "I'm okay, just resting",
    "Please give me a moment",
].map((text, index) => ({ id: `default-${index}`, text }));

export function useFavourites(): {
    readonly add: (text: string) => void;
    readonly favourites: readonly Favourite[];
    readonly remove: (id: string) => void;
} {
    const [favourites, setFavourites] = useState<readonly Favourite[]>(
        () =>
            readJson<readonly Favourite[]>(FAVOURITES_KEY) ??
            DEFAULT_FAVOURITES,
    );
    const save = (next: readonly Favourite[]) => {
        setFavourites(next);
        writeJson(FAVOURITES_KEY, next);
    };
    return {
        add: (text: string) =>
            save([{ id: crypto.randomUUID(), text }, ...favourites]),
        favourites,
        remove: (id: string) =>
            save(favourites.filter((favourite) => favourite.id !== id)),
    };
}
