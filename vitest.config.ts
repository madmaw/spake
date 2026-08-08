import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            exclude: ["build", "dist", "node_modules"],
            passWithNoTests: true,
            projects: [
                {
                    extends: true,
                    test: {
                        css: {
                            include: /.+/,
                            modules: {
                                classNameStrategy: "scoped",
                            },
                        },
                        environment: "happy-dom",
                        globals: true,
                        include: ["src/**/(*.)+(tests).[jt]s?(x)"],
                        name: "unit",
                        setupFiles: ["./.vitest/install.ts"],
                        testTimeout: 5000,
                    },
                },
                {
                    extends: true,
                    plugins: [storybookTest({})],
                    test: {
                        browser: {
                            enabled: true,
                            headless: true,
                            instances: [{ browser: "chromium" }],
                            isolate: false,
                            provider: playwright(),
                            viewport: {
                                height: 720,
                                width: 1024,
                            },
                        },
                        env: {
                            STORYBOOK_ENABLED: "true",
                        },
                        name: "storybook",
                        setupFiles: ["./.vitest/install.ts"],
                        testTimeout: 30000,
                    },
                },
            ],
        },
    }),
);
