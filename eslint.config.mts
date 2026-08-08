import js from "@eslint/js";
import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import eslintReact from "@eslint-react/eslint-plugin";
import { defineConfig } from "eslint/config";
import biome from "eslint-config-biome";
import { parseForESLint } from "eslint-parser-plain";
import noRelativeImportPaths from "eslint-plugin-no-relative-import-paths";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint, { type ConfigWithExtends } from "typescript-eslint";

// simplified from the compass web @compass/eslint shared config: generic rules kept,
// project-specific (lingui/mobx/mantine/compass) rules dropped

// Used for slow rules that we still want to check. Because it's not easy to check
// these rules in the IDE we make them warnings for developer experience reasons
const isCI = process.env.CI === "true";
const warnInCIOnly = isCI ? "warn" : "off";

// for help writing no-restricted-syntax rules see
// https://eslint.org/docs/latest/rules/no-restricted-syntax
const NO_RESTRICTED_SYNTAX_RULES = [
    {
        message: "useEffect must always be called with a list of dependencies",
        selector:
            "CallExpression[callee.name='useEffect'][arguments.length!=2]",
    },
    {
        message:
            "calling Array operations with a second parameter will overwrite the `this` arg creating subtle, hard to track down, bugs. Are you sure you want to do that?",
        selector:
            "CallExpression[callee.property.name=/^((map)|(filter)|(every)|(some)|(flatMap)|(index)|(find)|(findIndex)|(forEach))$/][arguments.length>1]",
    },
    // === null
    {
        message: "use == null instead",
        selector:
            'BinaryExpression[operator="==="][right.value=null][right.type=Literal]',
    },
    // == undefined (note that undefined values have no attributes in the AST)
    {
        message: "use == null instead",
        selector:
            'BinaryExpression[operator="=="][right.value=undefined][right.name=undefined][right.type=Identifier]',
    },
    // === undefined
    {
        message: "use == null instead",
        selector:
            'BinaryExpression[operator="==="][right.value=undefined][right.name=undefined][right.type=Identifier]',
    },
    // ban Boolean
    {
        message: "just use a boolean expression",
        selector: 'CallExpression[callee.name="Boolean"]',
    },
    // ban new Boolean
    {
        message: "use a lower-case boolean value instead",
        selector: 'NewExpression[callee.name="Boolean"]',
    },
    // disallow calling capitalized functions directly
    {
        message:
            "Calling a React Component as a function is potentially dangerous. Call via JSX instead.",
        selector:
            "CallExpression[callee.name=/^(?!Symbol|Number|BigInt|String)[A-Z].*/]",
    },
    // Enforce the use of the name "styles" for imported css modules
    {
        message: "use the name 'styles' for CSS module imports",
        selector:
            "ImportDeclaration[source.value=/^.*\\.module\\.css$/] > ImportDefaultSpecifier[local.name=/^.*(?<![Ss]tyles)$/]",
    },
] as const;

const TEST_IMPORT_RESTRICTIONS = [
    {
        message:
            "Don't use test imports in production code. Importing this here will break Vite!",
        name: "vitest",
    },
    {
        message: "Don't use test imports in production code",
        name: "storybook",
    },
] as const;

const SPECS_FILES = ["src/**/specs/*.ts", "src/**/specs/*.tsx"];

function createTSConfig(c: Partial<ConfigWithExtends>): ConfigWithExtends {
    return {
        linterOptions: {
            reportUnusedDisableDirectives: "error",
        },
        ...c,
        extends: [
            tseslint.configs.recommendedTypeChecked,
            tseslint.configs.stylisticTypeChecked,
            comments.recommended,
            biome,
            js.configs.recommended,
            // reactHooks recommended rules are intentionally left out; we only want
            // the rules that specifically handle react compiler warnings
            eslintReact.configs["recommended-type-checked"],
            ...(c.extends ?? []),
        ],
        languageOptions: {
            globals: {
                JSX: true,
                React: true,
                ...globals.browser,
            },
            ...(c.languageOptions ?? {}),
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
                ...(c.languageOptions?.parserOptions ?? {}),
            },
        },
        plugins: {
            "no-relative-import-paths": noRelativeImportPaths,
            "react-hooks": reactHooks,
            ...(c.plugins ?? {}),
        },
        rules: {
            "@eslint-react/component-hook-factories": "off",
            // biome does this
            "@eslint-react/exhaustive-deps": "off",
            "@eslint-react/jsx-shorthand-boolean": "error",
            // biome does this
            "@eslint-react/no-array-index-key": "off",
            // turn leaky conditional rendering into an error (warn by default)
            "@eslint-react/no-leaked-conditional-rendering": "error",
            // covered better by biome
            "@eslint-react/rules-of-hooks": "off",
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-check": false,
                    "ts-expect-error": true,
                    "ts-ignore": true,
                    "ts-nocheck": true,
                },
            ],
            "@typescript-eslint/consistent-type-assertions": [
                "error",
                {
                    arrayLiteralTypeAssertions: "allow",
                    assertionStyle: "as",
                    objectLiteralTypeAssertions: "allow-as-parameter",
                },
            ],
            // conflicts with biome: style/useShorthandObjectType
            "@typescript-eslint/consistent-type-definitions": "off",
            "@typescript-eslint/naming-convention": [
                "error",
                {
                    format: ["UPPER_CASE"],
                    selector: "enumMember",
                },
                {
                    format: ["PascalCase"],
                    selector: "typeLike",
                    trailingUnderscore: "allow",
                },
                {
                    format: ["camelCase", "UPPER_CASE", "PascalCase"],
                    leadingUnderscore: "allow",
                    selector: "variable",
                },
                {
                    format: ["camelCase", "PascalCase"],
                    leadingUnderscore: "allow",
                    selector: "parameter",
                },
            ],
            // handled by biome: correctness/noEmptyObjectType
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-floating-promises": [
                "error",
                {
                    checkThenables: true,
                },
            ],
            // biome does this
            "@typescript-eslint/no-inferrable-types": "off",
            "@typescript-eslint/no-unnecessary-condition": [
                "error",
                {
                    allowConstantLoopConditions: "only-allowed-literals",
                    checkTypePredicates: true,
                },
            ],
            // no-unsafe-assignment is very slow
            "@typescript-eslint/no-unsafe-assignment": warnInCIOnly,
            // handled by biome: lint/complexity/noBannedTypes
            "@typescript-eslint/no-unsafe-function-type": "off",
            // migrated to biome: noUnusedVariables
            "@typescript-eslint/no-unused-vars": "off",
            // conflicts with biome: style/useAsConstAssertion
            "@typescript-eslint/non-nullable-type-assertion-style": "off",
            // not an issue, causes other linting errors
            "@typescript-eslint/prefer-promise-reject-errors": "off",
            "@typescript-eslint/strict-boolean-expressions": [
                "error",
                {
                    allowNullableBoolean: true,
                },
            ],
            "arrow-body-style": ["error", "as-needed"],
            "default-case": "error",
            // migrated to biome: noDoubleEquals
            eqeqeq: "off",
            // handled by biome: correctness/noAsyncPromiseExecutor
            "no-async-promise-executor": "off",
            // handled by biome: lint/correctness/noEmptyPattern
            "no-empty-pattern": "off",
            // eslint doesn't understand typescript overloading
            "no-redeclare": "off",
            "no-restricted-syntax": ["error", ...NO_RESTRICTED_SYNTAX_RULES],
            // @typescript-eslint/no-unused-vars does this better
            "no-unused-vars": "off",
            "react-hooks/preserve-manual-memoization": "error",
            "react-hooks/unsupported-syntax": "error",
            "require-await": "error",
            // handled by biome: correctness/useYield
            "require-yield": "off",
            ...(c.rules ?? {}),
        },
    };
}

export default [
    {
        // NOTE: if `ignores` isn't on its own it will not apply globally
        ignores: [
            "build/**",
            "dist/**",
            "node_modules/**",
            "storybook-static/**",
            "src/**/*.generated.ts",
        ],
    },
    ...defineConfig({
        // files not covered by biome
        files: ["*.yaml", ".gitignore", "*.md", "*.html"],
        ignores: ["pnpm-lock.yaml"],
        languageOptions: {
            parser: {
                // turn off all language features
                parseForESLint,
            },
        },
        rules: {
            "eol-last": ["error", "always"],
            "no-multiple-empty-lines": [
                "error",
                {
                    max: 1,
                    maxBOF: 0,
                    maxEOF: 0,
                },
            ],
            "no-trailing-spaces": ["error"],
        },
    }),
    ...tseslint.config([
        // lint source files
        createTSConfig({
            files: ["src/**/*.ts", "src/**/*.tsx"],
            ignores: SPECS_FILES,
            rules: {
                "no-relative-import-paths/no-relative-import-paths": [
                    "error",
                    {
                        allowSameFolder: true,
                        prefix: "",
                        rootDir: "src",
                    },
                ],
                "no-restricted-exports": [
                    "error",
                    {
                        restrictDefaultExports: {
                            defaultFrom: true,
                            direct: true,
                            named: true,
                            namedFrom: true,
                            namespaceFrom: true,
                        },
                    },
                ],
                "no-restricted-imports": [
                    "error",
                    {
                        paths: [...TEST_IMPORT_RESTRICTIONS],
                        patterns: [
                            {
                                message:
                                    "Don't use test imports in production code",
                                regex: "^(@?storybook|@testing-library)\\/.*$",
                            },
                            {
                                message:
                                    "Are you sure you want to import a JS file?",
                                regex: ".*\\.js$",
                            },
                        ],
                    },
                ],
            },
        }),
        // lint tests and stories (in specs folders) and the vitest setup, which
        // are all part of the main (browser) project
        createTSConfig({
            files: [...SPECS_FILES, ".vitest/*.ts"],
            rules: {
                // mock data is not always camelCase
                "@typescript-eslint/naming-convention": "off",
                // storybook renders components as functions in play/render helpers
                "no-restricted-syntax": "off",
            },
        }),
        // lint supporting files (configs, storybook main); these are not part
        // of the main tsconfig so they use the default project
        createTSConfig({
            files: ["*.ts", "*.mts", ".storybook/*.ts", ".storybook/*.tsx"],
            languageOptions: {
                globals: globals.node,
                parserOptions: {
                    projectService: {
                        allowDefaultProject: [
                            "*.ts",
                            "*.mts",
                            ".storybook/*.ts",
                        ],
                        defaultProject: "tsconfig.node.json",
                    },
                },
            },
            rules: {
                // configs call capitalised factories like VitePWA(); the
                // React-component-call ban doesn't apply here
                "no-restricted-syntax": "off",
            },
        }),
    ]),
];
