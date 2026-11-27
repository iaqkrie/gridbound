import { BuiltinInterfaceId, InterfaceId, InterfaceManifest } from './types';

export interface BuiltinInterfaceMeta {
  id: BuiltinInterfaceId;
  name: string;
  description: string;
  role: 'popover' | 'modal' | 'hover';
  resultType: 'string' | 'boolean' | 'none';
}

export const BUILTIN_INTERFACE_IDS: BuiltinInterfaceId[] = [
  '@builtin/cell_picker',
  '@builtin/confirm',
  '@builtin/inspector',
];

export const BUILTIN_INTERFACES: Record<BuiltinInterfaceId, BuiltinInterfaceMeta> = {
  '@builtin/cell_picker': {
    id: '@builtin/cell_picker',
    name: 'Cell Picker',
    description:
      'Universal choice list displaying cell sprites, labels, and optional badges. Returns the chosen cellId to On Result.',
    role: 'popover',
    resultType: 'string',
  },
  '@builtin/confirm': {
    id: '@builtin/confirm',
    name: 'Confirm Dialog',
    description:
      'Universal confirmation modal with title, message, lines, warnings, and Confirm/Cancel actions. Returns true or false to On Result.',
    role: 'modal',
    resultType: 'boolean',
  },
  '@builtin/inspector': {
    id: '@builtin/inspector',
    name: 'Cell Inspector',
    description:
      'Read-only hover/inspect card showing cell name, sprite swatch, local supplies, and public/readonly cell state.',
    role: 'hover',
    resultType: 'none',
  },
};

export function isBuiltinInterfaceId(id: InterfaceId): id is BuiltinInterfaceId {
  return (
    id === '@builtin/cell_picker' ||
    id === '@builtin/confirm' ||
    id === '@builtin/inspector'
  );
}

/**
 * Helper for the future visual editor: clones a read-only built-in interface
 * into an editable custom InterfaceManifest under a new ruleset-owned ID.
 */
export function cloneBuiltinInterface(
  builtinId: BuiltinInterfaceId,
  newId: string
): InterfaceManifest {
  switch (builtinId) {
    case '@builtin/inspector':
      return {
        id: newId,
        title: '{{cell.name}}',
        role: 'hover',
        width: 240,
        showSwatch: true,
        blocks: [
          { kind: 'supplyList', onlyPositive: true },
          { kind: 'cellStateList' },
        ],
      };
    case '@builtin/confirm':
      return {
        id: newId,
        title: '{{param.title}}',
        role: 'modal',
        width: 280,
        showSwatch: false,
        blocks: [
          { kind: 'text', text: '{{param.message}}', tone: 'muted' },
          {
            kind: 'buttonRow',
            buttons: [
              { label: 'Cancel', closeResult: false, variant: 'secondary' },
              { label: 'Confirm', closeResult: true, variant: 'danger' },
            ],
          },
        ],
      };
    case '@builtin/cell_picker':
      return {
        id: newId,
        title: '{{param.title}}',
        role: 'popover',
        width: 270,
        showSwatch: false,
        blocks: [
          { kind: 'text', text: 'Select an option', tone: 'muted' },
        ],
      };
  }
}
