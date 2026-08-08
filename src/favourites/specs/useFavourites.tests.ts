import { act, renderHook } from "@testing-library/react";
import { useFavourites } from "src/favourites/useFavourites";
import { beforeEach, describe, expect, it } from "vitest";

describe("useFavourites", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("starts with default favourites", () => {
        const { result } = renderHook(() => useFavourites());
        expect(result.current.favourites.length).toBeGreaterThan(0);
    });

    it("adds favourites to the front", () => {
        const { result } = renderHook(() => useFavourites());
        act(() => result.current.add("Hello there"));
        expect(result.current.favourites[0].text).toBe("Hello there");
    });

    it("removes favourites", () => {
        const { result } = renderHook(() => useFavourites());
        act(() => result.current.add("Hello there"));
        const { id } = result.current.favourites[0];
        act(() => result.current.remove(id));
        expect(result.current.favourites.map(({ text }) => text)).not.toContain(
            "Hello there",
        );
    });

    it("persists favourites", () => {
        const first = renderHook(() => useFavourites());
        act(() => first.result.current.add("Hello there"));
        first.unmount();
        const second = renderHook(() => useFavourites());
        expect(second.result.current.favourites[0].text).toBe("Hello there");
    });
});
