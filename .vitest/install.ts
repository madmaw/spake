import { beforeAll } from "vitest";
import failOnConsole from "vitest-fail-on-console";

failOnConsole();

if (import.meta.env.STORYBOOK_ENABLED === "true") {
    const [{ setProjectAnnotations }, projectAnnotations] = await Promise.all([
        import("@storybook/react"),
        import("../.storybook/preview"),
    ]);
    const annotations = setProjectAnnotations([projectAnnotations.default]);
    beforeAll(annotations.beforeAll);
}
