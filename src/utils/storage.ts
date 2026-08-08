export function readJson<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(key);
        return raw == null ? null : (JSON.parse(raw) as T);
    } catch (error) {
        console.warn(`failed to read ${key} from storage`, error);
        return null;
    }
}

export function writeJson(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`failed to write ${key} to storage`, error);
    }
}
