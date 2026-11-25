import { RulesetManifest, RulesetPackage } from '../../engine/sdk';
import rawManifest from './ruleset.json';

/**
 * Classic Colony Ruleset Package.
 *
 * Custom TS generators, TS cell behaviors, or TSX cell panels can be attached
 * inside `modules` and referenced by ID from `ruleset.json`.
 */
export const classicColonyPackage: RulesetPackage = {
  manifest: rawManifest as unknown as RulesetManifest,
  modules: {
    generators: {},
    behaviors: {},
    panels: {},
  },
};
