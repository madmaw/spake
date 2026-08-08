// these packages lack type definitions, so we trick TS here
declare module "eslint-config-biome";
declare module "eslint-parser-plain" {
    export const parseForESLint: (code: string) => object;
}
