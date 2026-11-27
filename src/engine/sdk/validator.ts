import { isBuiltinInterfaceId } from './builtinInterfaces';
import { getNodeDefinition } from './nodeRegistry';
import {
  CURRENT_SCHEMA_VERSION,
  CellTypeManifest,
  GlobalVariableManifest,
  GraphScope,
  NodeGraph,
  RulesetManifest,
} from './types';

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

export function validateRulesetManifest(manifest: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: [{ path: '', message: 'Manifest must be an object' }] };
  }

  const m = manifest as RulesetManifest;

  if (m.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    err(
      'schemaVersion',
      `Unsupported schemaVersion "${String(m.schemaVersion)}". Expected ${CURRENT_SCHEMA_VERSION}.`
    );
  }
  if (!m.id || typeof m.id !== 'string') err('id', 'Ruleset id is required');
  if (!m.name || typeof m.name !== 'string') err('name', 'Ruleset name is required');
  if (
    !m.defaultGridSize ||
    m.defaultGridSize.width < 4 ||
    m.defaultGridSize.height < 4
  ) {
    err('defaultGridSize', 'defaultGridSize must be at least 4x4');
  }

  // ── Sprites ──────────────────────────────────────────────────────────────
  const spriteIds = new Set<string>();
  if (!Array.isArray(m.sprites)) {
    err('sprites', 'sprites must be an array');
  } else {
    m.sprites.forEach((s, i) => {
      if (!s.id) err(`sprites[${i}].id`, 'Sprite id is required');
      else if (spriteIds.has(s.id)) err(`sprites[${i}].id`, `Duplicate sprite id "${s.id}"`);
      else spriteIds.add(s.id);

      if (s.width !== 32 || s.height !== 32) {
        err(`sprites[${i}]`, `Sprite "${s.id}" must be 32x32`);
      }
      if (!s.dataUrl || typeof s.dataUrl !== 'string') {
        err(`sprites[${i}].dataUrl`, `Sprite "${s.id}" requires a PNG dataUrl`);
      }
    });
  }

  // ── GlobalState ──────────────────────────────────────────────────────────
  const globalVarMap = new Map<string, GlobalVariableManifest>();
  if (!m.globalState || typeof m.globalState !== 'object') {
    err('globalState', 'globalState is required');
  } else {
    if (!Array.isArray(m.globalState.variables)) {
      err('globalState.variables', 'globalState.variables must be an array');
    } else {
      m.globalState.variables.forEach((v, i) => {
        if (!v.id) err(`globalState.variables[${i}].id`, 'Variable id is required');
        else if (globalVarMap.has(v.id)) {
          err(`globalState.variables[${i}].id`, `Duplicate global variable "${v.id}"`);
        } else {
          globalVarMap.set(v.id, v);
        }
        if (!['public', 'readonly', 'private'].includes(v.access)) {
          err(`globalState.variables[${i}].access`, `Invalid access "${String(v.access)}"`);
        }
        if (!['number', 'boolean', 'string'].includes(v.type)) {
          err(`globalState.variables[${i}].type`, `Invalid type "${String(v.type)}"`);
        }
      });
    }

    if (Array.isArray(m.globalState.hud)) {
      m.globalState.hud.forEach((h, i) => {
        if (!globalVarMap.has(h.variableId)) {
          err(
            `globalState.hud[${i}].variableId`,
            `HUD references unknown global variable "${h.variableId}"`
          );
        }
      });
    } else {
      err('globalState.hud', 'globalState.hud must be an array');
    }
  }

  // ── Supplies (Unified Numeric) ───────────────────────────────────────────
  const supplyIds = new Set<string>();
  if (!Array.isArray(m.supplies)) {
    err('supplies', 'supplies must be an array');
  } else {
    m.supplies.forEach((s, i) => {
      if (!s.id) err(`supplies[${i}].id`, 'Supply id is required');
      else if (supplyIds.has(s.id)) err(`supplies[${i}].id`, `Duplicate supply "${s.id}"`);
      else supplyIds.add(s.id);
      if (!s.decay) err(`supplies[${i}].decay`, 'Supply decay rule is required');
    });
  }

  // ── Interfaces ───────────────────────────────────────────────────────────
  const customInterfaceIds = new Set<string>();
  if (!Array.isArray(m.interfaces)) {
    err('interfaces', 'interfaces must be an array');
  } else {
    m.interfaces.forEach((iface, i) => {
      if (!iface.id) {
        err(`interfaces[${i}].id`, 'Interface id is required');
      } else if (iface.id.startsWith('@builtin/')) {
        err(
          `interfaces[${i}].id`,
          `Custom interface id "${iface.id}" cannot use reserved "@builtin/" prefix`
        );
      } else if (customInterfaceIds.has(iface.id)) {
        err(`interfaces[${i}].id`, `Duplicate interface id "${iface.id}"`);
      } else {
        customInterfaceIds.add(iface.id);
      }
    });
  }

  const hasInterface = (id: string): boolean =>
    isBuiltinInterfaceId(id) || customInterfaceIds.has(id);

  if (
    m.defaultHoverInterfaceId !== undefined &&
    m.defaultHoverInterfaceId !== null &&
    !hasInterface(m.defaultHoverInterfaceId)
  ) {
    err(
      'defaultHoverInterfaceId',
      `Unknown default hover interface "${m.defaultHoverInterfaceId}"`
    );
  }

  // ── Cell Types ───────────────────────────────────────────────────────────
  const cellTypeMap = new Map<string, CellTypeManifest>();
  if (!Array.isArray(m.cellTypes) || m.cellTypes.length === 0) {
    err('cellTypes', 'At least one cellType is required');
  } else {
    m.cellTypes.forEach((ct, i) => {
      if (!ct.id) err(`cellTypes[${i}].id`, 'CellType id is required');
      else if (cellTypeMap.has(ct.id)) err(`cellTypes[${i}].id`, `Duplicate cellType "${ct.id}"`);
      else cellTypeMap.set(ct.id, ct);

      if (ct.defaultSpriteId && !spriteIds.has(ct.defaultSpriteId)) {
        err(
          `cellTypes[${i}].defaultSpriteId`,
          `Unknown sprite "${ct.defaultSpriteId}"`
        );
      }
      if (ct.substrateSpriteId && !spriteIds.has(ct.substrateSpriteId)) {
        err(
          `cellTypes[${i}].substrateSpriteId`,
          `Unknown substrate sprite "${ct.substrateSpriteId}"`
        );
      }
      if (
        ct.hoverInterfaceId !== undefined &&
        ct.hoverInterfaceId !== null &&
        !hasInterface(ct.hoverInterfaceId)
      ) {
        err(
          `cellTypes[${i}].hoverInterfaceId`,
          `Unknown hover interface "${ct.hoverInterfaceId}"`
        );
      }
      if (!Array.isArray(ct.stateSchema)) {
        err(`cellTypes[${i}].stateSchema`, 'stateSchema must be an array');
      }
    });
  }

  if (!cellTypeMap.has(m.defaultCellTypeId)) {
    err('defaultCellTypeId', `Unknown defaultCellTypeId "${m.defaultCellTypeId}"`);
  }

  // ── Graph Validation Helper ──────────────────────────────────────────────
  const validateGraph = (
    graph: NodeGraph | undefined,
    scope: GraphScope,
    path: string
  ) => {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      err(path, 'Graph must have nodes[] and edges[]');
      return;
    }

    const nodeIds = new Set<string>();
    let hasGenOutput = false;

    graph.nodes.forEach((node, idx) => {
      const nodePath = `${path}.nodes[${idx}]`;
      if (!node.id) {
        err(nodePath, 'Node id is required');
      } else if (nodeIds.has(node.id)) {
        err(nodePath, `Duplicate node id "${node.id}"`);
      } else {
        nodeIds.add(node.id);
      }

      const def = getNodeDefinition(node.type);
      if (!def) {
        err(nodePath, `Unknown node type "${node.type}"`);
        return;
      }
      if (!def.scopes.includes(scope)) {
        err(nodePath, `Node "${node.type}" is not allowed in "${scope}" graph`);
      }

      if (node.type === 'gen.output') {
        hasGenOutput = true;
      }

      // Static reference & access-control checks for literal node data
      const data = node.data ?? {};
      if (
        node.type === 'global.get' ||
        node.type === 'global.getCap' ||
        node.type === 'global.set' ||
        node.type === 'global.add' ||
        node.type === 'global.consume' ||
        node.type === 'global.addCap'
      ) {
        const varId = typeof data.varId === 'string' ? data.varId : '';
        if (varId) {
          const gVar = globalVarMap.get(varId);
          if (!gVar) {
            err(nodePath, `References unknown global variable "${varId}"`);
          } else if (scope !== 'global') {
            if (gVar.access === 'private') {
              err(
                nodePath,
                `Global variable "${varId}" is private and cannot be accessed from "${scope}" graph`
              );
            }
            const isWrite =
              node.type === 'global.set' ||
              node.type === 'global.add' ||
              node.type === 'global.consume' ||
              node.type === 'global.addCap';
            if (isWrite && gVar.access === 'readonly') {
              err(
                nodePath,
                `Global variable "${varId}" is readonly and cannot be mutated from "${scope}" graph`
              );
            }
          }
        }
      }

      if (node.type === 'supply.get' || node.type === 'supply.emit' || node.type === 'supply.consume') {
        const supplyId = typeof data.supplyId === 'string' ? data.supplyId : '';
        if (supplyId && !supplyIds.has(supplyId)) {
          err(nodePath, `References unknown supply "${supplyId}"`);
        }
      }

      if (node.type === 'cell.setSprite') {
        const spriteId = typeof data.spriteId === 'string' ? data.spriteId : '';
        if (spriteId && !spriteIds.has(spriteId)) {
          err(nodePath, `References unknown sprite "${spriteId}"`);
        }
      }

      if (node.type === 'cell.transform') {
        const toId = typeof data.toId === 'string' ? data.toId : '';
        if (toId && !cellTypeMap.has(toId)) {
          err(nodePath, `Transforms to unknown cellType "${toId}"`);
        }
      }

      if (node.type === 'ui.openInterface') {
        const ifaceId = typeof data.interfaceId === 'string' ? data.interfaceId : '';
        if (!ifaceId || !hasInterface(ifaceId)) {
          err(nodePath, `Opens unknown interface "${ifaceId}"`);
        }
      }

      if (node.type === 'gen.fillLayer' || node.type === 'gen.paintLayer') {
        const cellTypeId = typeof data.cellTypeId === 'string' ? data.cellTypeId : '';
        if (cellTypeId && !cellTypeMap.has(cellTypeId)) {
          err(nodePath, `Generator paints unknown cellType "${cellTypeId}"`);
        }
      }
    });

    graph.edges.forEach((edge, idx) => {
      const edgePath = `${path}.edges[${idx}]`;
      if (!nodeIds.has(edge.fromNode)) {
        err(edgePath, `Edge fromNode "${edge.fromNode}" does not exist`);
      }
      if (!nodeIds.has(edge.toNode)) {
        err(edgePath, `Edge toNode "${edge.toNode}" does not exist`);
      }
    });

    if (scope === 'generator' && !hasGenOutput) {
      err(path, 'worldGenerator graph must include a "gen.output" node');
    }
  };

  if (m.globalState?.graph) {
    validateGraph(m.globalState.graph, 'global', 'globalState.graph');
  }
  validateGraph(m.worldGenerator, 'generator', 'worldGenerator');

  if (Array.isArray(m.interfaces)) {
    m.interfaces.forEach((iface, i) => {
      if (iface.graph) {
        validateGraph(iface.graph, 'interface', `interfaces[${i}].graph`);
      }
    });
  }

  if (Array.isArray(m.cellTypes)) {
    m.cellTypes.forEach((ct, i) => {
      validateGraph(ct.graph, 'cell', `cellTypes[${i}].graph`);
    });
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidRuleset(manifest: unknown): RulesetManifest {
  const result = validateRulesetManifest(manifest);
  if (!result.valid) {
    const details = result.errors.map((e) => `  • ${e.path || 'root'}: ${e.message}`).join('\n');
    throw new Error(`Invalid Gridbound Schema v4 ruleset manifest:\n${details}`);
  }
  return manifest as RulesetManifest;
}
