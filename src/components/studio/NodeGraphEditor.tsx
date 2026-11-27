import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  LayoutGrid,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  getNodeDefinition,
  getNodesForScope,
  GraphEdge,
  GraphNode,
  GraphScope,
  NodeCategory,
  NodeGraph,
  PortDef,
  PortType,
  RulesetManifest,
  StateFieldManifest,
} from '../../engine/sdk';
import { NodeInspector } from './NodeInspector';
import { autoLayoutGraph, makeUniqueId } from './studioUtils';

interface NodeGraphEditorProps {
  graph: NodeGraph;
  scope: GraphScope;
  manifest: RulesetManifest;
  cellStateSchema?: StateFieldManifest[];
  readOnly?: boolean;
  onChange: (nextGraph: NodeGraph) => void;
}

const NODE_WIDTH = 204;
const HEADER_H = 30;
const PORT_ROW_H = 24;
const BODY_PAD_TOP = 8;

const PORT_COLOR: Record<PortType, string> = {
  exec: '#E6EDF3',
  number: '#38BDF8',
  boolean: '#F43F5E',
  string: '#F59E0B',
  any: '#94A3B8',
  mask: '#2DD4BF',
  layer: '#A78BFA',
};

const CATEGORY_ACCENT: Record<NodeCategory, string> = {
  event: '#10B981',
  flow: '#64748B',
  value: '#38BDF8',
  math: '#0EA5E9',
  logic: '#F43F5E',
  string: '#F59E0B',
  global: '#EAB308',
  cell: '#22C55E',
  supply: '#06B6D4',
  world: '#8B5CF6',
  notify: '#F97316',
  ui: '#EC4899',
  generator: '#2DD4BF',
};

function getEffectiveOutputs(node: GraphNode): PortDef[] {
  const def = getNodeDefinition(node.type);
  if (!def) return [];
  if (node.type === 'flow.switchString') {
    const cases = Array.isArray(node.data?.cases)
      ? (node.data!.cases as string[])
      : [];
    const casePorts: PortDef[] = cases.map((c, idx) => ({
      id: `case_${idx}`,
      label: c || `Case ${idx}`,
      type: 'exec',
    }));
    return [...casePorts, ...def.outputs];
  }
  return def.outputs;
}

function getEffectiveInputs(node: GraphNode): PortDef[] {
  return getNodeDefinition(node.type)?.inputs ?? [];
}

function arePortsCompatible(fromType: PortType, toType: PortType): boolean {
  if (fromType === 'exec' || toType === 'exec') {
    return fromType === 'exec' && toType === 'exec';
  }
  if (fromType === 'mask' || toType === 'mask') {
    return fromType === 'mask' && toType === 'mask';
  }
  if (fromType === 'layer' || toType === 'layer') {
    return fromType === 'layer' && toType === 'layer';
  }
  if (fromType === 'any' || toType === 'any') return true;
  return fromType === toType;
}

function getPortPosition(
  node: GraphNode,
  side: 'in' | 'out',
  portId: string
): { x: number; y: number } {
  const pos = node.position ?? { x: 48, y: 48 };
  const list =
    side === 'in' ? getEffectiveInputs(node) : getEffectiveOutputs(node);
  const idx = Math.max(
    0,
    list.findIndex((p) => p.id === portId)
  );
  return {
    x: side === 'in' ? pos.x : pos.x + NODE_WIDTH,
    y: pos.y + HEADER_H + BODY_PAD_TOP + idx * PORT_ROW_H + PORT_ROW_H / 2,
  };
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function summarizeNode(node: GraphNode): string {
  const d = node.data ?? {};
  switch (node.type) {
    case 'event.uiAction':
      return String(d.actionId ?? '');
    case 'const.value':
    case 'gen.constNumber':
      return String(d.value ?? 0);
    case 'get.setupParam':
    case 'gen.setupParam':
      return String(d.paramId ?? '');
    case 'global.get':
    case 'global.getCap':
    case 'global.set':
    case 'global.add':
    case 'global.consume':
    case 'global.addCap':
      return [
        d.varId ? String(d.varId) : 'wired',
        d.amount !== undefined ? `${d.amount}` : '',
        d.delta !== undefined ? `${Number(d.delta) >= 0 ? '+' : ''}${d.delta}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
    case 'cell.getState':
    case 'cell.setState':
    case 'cell.addState':
      return [d.key, d.value !== undefined ? `= ${d.value}` : '', d.amount !== undefined ? `+${d.amount}` : '']
        .filter(Boolean)
        .join(' ');
    case 'cell.setSprite':
      return d.spriteId ? String(d.spriteId) : 'wired';
    case 'cell.transform':
      return [d.toId || 'wired', d.reason ? `(${d.reason})` : '']
        .filter(Boolean)
        .join(' ');
    case 'supply.get':
    case 'supply.emit':
    case 'supply.consume':
      return [d.supplyId, d.amount !== undefined ? `×${d.amount}` : '']
        .filter(Boolean)
        .join(' ');
    case 'ui.openInterface':
      return String(d.interfaceId ?? '');
    case 'logic.compare':
      return `${d.op ?? '=='} ${d.b ?? ''}`;
    case 'math.op':
    case 'gen.math':
      return `${d.op ?? 'add'}`;
    case 'gen.fillLayer':
    case 'gen.paintLayer':
      return String(d.cellTypeId ?? '');
    case 'notify.cell':
    case 'notify.global':
      return String(d.title ?? '');
    default:
      return '';
  }
}

export function NodeGraphEditor({
  graph,
  scope,
  manifest,
  cellStateSchema,
  readOnly,
  onChange,
}: NodeGraphEditorProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState({ x: 32, y: 32, zoom: 0.92 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePos, setPalettePos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [paletteSearch, setPaletteSearch] = useState('');

  // Wire dragging state
  const [draggingWire, setDraggingWire] = useState<{
    fromNode: string;
    fromPort: string;
    fromType: PortType;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);

  // Pan & node drag refs
  const panRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const nodeDragRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const scopeNodes = useMemo(() => getNodesForScope(scope), [scope]);

  const filteredPalette = useMemo(() => {
    const q = paletteSearch.trim().toLowerCase();
    const list = q
      ? scopeNodes.filter(
          (n) =>
            n.label.toLowerCase().includes(q) ||
            n.type.toLowerCase().includes(q) ||
            n.category.toLowerCase().includes(q)
        )
      : scopeNodes;
    const grouped = new Map<NodeCategory, typeof list>();
    for (const def of list) {
      const arr = grouped.get(def.category) ?? [];
      arr.push(def);
      grouped.set(def.category, arr);
    }
    return Array.from(grouped.entries());
  }, [scopeNodes, paletteSearch]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of graph.nodes) map.set(n.id, n);
    return map;
  }, [graph.nodes]);

  const selectedNode = selectedNodeId ? (nodeMap.get(selectedNodeId) ?? null) : null;

  const clientToGraph = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - camera.x) / camera.zoom,
        y: (clientY - rect.top - camera.y) / camera.zoom,
      };
    },
    [camera]
  );

  const fitView = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || graph.nodes.length === 0) {
      setCamera({ x: 32, y: 32, zoom: 0.92 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of graph.nodes) {
      const p = n.position ?? { x: 48, y: 48 };
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_WIDTH);
      maxY = Math.max(maxY, p.y + 120);
    }
    const contentW = Math.max(240, maxX - minX + 96);
    const contentH = Math.max(200, maxY - minY + 96);
    const zoom = Math.max(
      0.4,
      Math.min(1.05, Math.min(rect.width / contentW, rect.height / contentH))
    );
    setCamera({
      zoom,
      x: Math.round((rect.width - (maxX - minX) * zoom) / 2 - minX * zoom),
      y: Math.round((rect.height - (maxY - minY) * zoom) / 2 - minY * zoom),
    });
  }, [graph.nodes]);

  // Fit view when switching to another graph object (e.g. different cell)
  const lastNodeCountRef = useRef<string>('');
  const graphIdentity = `${scope}:${graph.nodes[0]?.id ?? 'empty'}:${graph.nodes.length}`;
  useEffect(() => {
    if (lastNodeCountRef.current !== graphIdentity) {
      lastNodeCountRef.current = graphIdentity;
      if (selectedNodeId && !nodeMap.has(selectedNodeId)) {
        setSelectedNodeId(null);
      }
    }
  }, [graphIdentity, nodeMap, selectedNodeId]);

  const handleAddNode = (nodeType: string) => {
    if (readOnly) return;
    const def = getNodeDefinition(nodeType);
    if (!def) return;
    const newId = makeUniqueId(
      nodeType.replace('.', '_'),
      graph.nodes.map((n) => n.id)
    );
    const pos = palettePos ?? {
      x: Math.round((240 - camera.x) / camera.zoom),
      y: Math.round((160 - camera.y) / camera.zoom),
    };
    const nextNode: GraphNode = {
      id: newId,
      type: nodeType,
      data: def.defaultData ? JSON.parse(JSON.stringify(def.defaultData)) : {},
      position: { x: Math.round(pos.x), y: Math.round(pos.y) },
    };
    onChange({
      ...graph,
      nodes: [...graph.nodes, nextNode],
    });
    setSelectedNodeId(newId);
    setPaletteOpen(false);
    setPaletteSearch('');
  };

  const handleUpdateNodeData = (
    nodeId: string,
    nextData: Record<string, unknown>
  ) => {
    if (readOnly) return;
    onChange({
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: nextData } : n
      ),
    });
  };

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (readOnly) return;
      onChange({
        nodes: graph.nodes.filter((n) => n.id !== nodeId),
        edges: graph.edges.filter(
          (e) => e.fromNode !== nodeId && e.toNode !== nodeId
        ),
      });
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [graph, onChange, readOnly, selectedNodeId]
  );

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      if (readOnly) return;
      const orig = nodeMap.get(nodeId);
      if (!orig) return;
      const newId = makeUniqueId(
        orig.type.replace('.', '_'),
        graph.nodes.map((n) => n.id)
      );
      const copy: GraphNode = {
        id: newId,
        type: orig.type,
        data: orig.data ? JSON.parse(JSON.stringify(orig.data)) : {},
        position: {
          x: (orig.position?.x ?? 48) + 32,
          y: (orig.position?.y ?? 48) + 32,
        },
      };
      onChange({ ...graph, nodes: [...graph.nodes, copy] });
      setSelectedNodeId(newId);
    },
    [graph, nodeMap, onChange, readOnly]
  );

  const handleDeleteEdge = (edgeId: string) => {
    if (readOnly) return;
    onChange({
      ...graph,
      edges: graph.edges.filter((e) => e.id !== edgeId),
    });
  };

  // Keyboard shortcuts (Delete, Ctrl+D)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (readOnly || !selectedNodeId) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteNode(selectedNodeId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateNode(selectedNodeId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readOnly, selectedNodeId, handleDeleteNode, handleDuplicateNode]);

  // Wheel zoom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.91;
      setCamera((prev) => {
        const nextZoom = Math.max(0.35, Math.min(1.6, prev.zoom * factor));
        const ratio = nextZoom / prev.zoom;
        return {
          zoom: nextZoom,
          x: mx - (mx - prev.x) * ratio,
          y: my - (my - prev.y) * ratio,
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Pointer move/up for panning, node dragging, and wire dragging
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return;
    setSelectedNodeId(null);
    setPaletteOpen(false);
    panRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: camera.x,
      origY: camera.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current.active) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setCamera((prev) => ({
        ...prev,
        x: panRef.current.origX + dx,
        y: panRef.current.origY + dy,
      }));
      return;
    }

    if (nodeDragRef.current && !readOnly) {
      const drag = nodeDragRef.current;
      const dx = (e.clientX - drag.startClientX) / camera.zoom;
      const dy = (e.clientY - drag.startClientY) / camera.zoom;
      const nx = Math.round((drag.origX + dx) / 8) * 8;
      const ny = Math.round((drag.origY + dy) / 8) * 8;
      onChange({
        ...graph,
        nodes: graph.nodes.map((n) =>
          n.id === drag.nodeId ? { ...n, position: { x: nx, y: ny } } : n
        ),
      });
      return;
    }

    if (draggingWire) {
      const pt = clientToGraph(e.clientX, e.clientY);
      setDraggingWire((prev) => (prev ? { ...prev, curX: pt.x, curY: pt.y } : null));
    }
  };

  const handlePointerUp = () => {
    panRef.current.active = false;
    nodeDragRef.current = null;
    if (draggingWire) {
      setDraggingWire(null);
    }
  };

  const handleConnectToInput = (
    toNode: string,
    toPort: string,
    toType: PortType
  ) => {
    if (readOnly || !draggingWire) return;
    if (draggingWire.fromNode === toNode) {
      setDraggingWire(null);
      return;
    }
    if (!arePortsCompatible(draggingWire.fromType, toType)) {
      setDraggingWire(null);
      return;
    }

    // For data inputs, replace any existing incoming wire on that port; for exec, allow multiple incoming
    let nextEdges = graph.edges.filter((e) => {
      if (
        e.fromNode === draggingWire.fromNode &&
        e.fromPort === draggingWire.fromPort &&
        e.toNode === toNode &&
        e.toPort === toPort
      ) {
        return false;
      }
      if (toType !== 'exec' && e.toNode === toNode && e.toPort === toPort) {
        return false;
      }
      if (
        draggingWire.fromType === 'exec' &&
        e.fromNode === draggingWire.fromNode &&
        e.fromPort === draggingWire.fromPort
      ) {
        return false;
      }
      return true;
    });

    const edgeId = makeUniqueId(
      'edge',
      nextEdges.map((e) => e.id)
    );
    const newEdge: GraphEdge = {
      id: edgeId,
      fromNode: draggingWire.fromNode,
      fromPort: draggingWire.fromPort,
      toNode,
      toPort,
    };
    nextEdges = [...nextEdges, newEdge];
    onChange({ ...graph, edges: nextEdges });
    setDraggingWire(null);
  };

  return (
    <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden bg-[#0B0F14]">
      {/* Main Graph Viewport */}
      <div className="relative flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Top Graph Toolbar */}
        <div className="h-10 shrink-0 border-b border-[#1F2A38] bg-[#111720] px-3 flex items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-2">
            {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  setPalettePos(null);
                  setPaletteOpen((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#0B0F14] bg-[#10B981] hover:bg-[#0EA572] rounded transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Node</span>
              </button>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  onChange(autoLayoutGraph(graph));
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#8B98A9] hover:text-[#E6EDF3] bg-[#0B0F14] hover:bg-[#17202B] border border-[#1F2A38] rounded transition-colors cursor-pointer"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Auto Layout</span>
              </button>
            )}
            <span className="text-[11px] font-mono tabular-nums text-[#8B98A9] ml-1">
              {graph.nodes.length} nodes · {graph.edges.length} wires
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setCamera((c) => ({ ...c, zoom: Math.max(0.35, c.zoom * 0.85) }))
              }
              title="Zoom out"
              className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B] rounded cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono tabular-nums text-[11px] text-[#E6EDF3] w-10 text-center">
              {Math.round(camera.zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setCamera((c) => ({ ...c, zoom: Math.min(1.6, c.zoom * 1.15) }))
              }
              title="Zoom in"
              className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B] rounded cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={fitView}
              title="Fit graph to view"
              className="p-1 text-[#8B98A9] hover:text-[#E6EDF3] hover:bg-[#17202B] rounded cursor-pointer ml-1"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Interactive Infinite Canvas */}
        <div
          ref={viewportRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onContextMenu={(e) => {
            e.preventDefault();
            if (readOnly) return;
            setPalettePos(clientToGraph(e.clientX, e.clientY));
            setPaletteOpen(true);
          }}
          style={{
            backgroundImage:
              'radial-gradient(#1E2B3A 1px, transparent 1px)',
            backgroundSize: `${Math.max(12, Math.round(24 * camera.zoom))}px ${Math.max(12, Math.round(24 * camera.zoom))}px`,
            backgroundPosition: `${camera.x}px ${camera.y}px`,
          }}
          className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        >
          {/* Transformed World Layer */}
          <div
            style={{
              transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
              transformOrigin: '0 0',
            }}
            className="absolute top-0 left-0 w-0 h-0"
          >
            {/* SVG Edges Layer */}
            <svg
              className="overflow-visible pointer-events-none absolute top-0 left-0"
              width={1}
              height={1}
            >
              {graph.edges.map((edge) => {
                const fromNode = nodeMap.get(edge.fromNode);
                const toNode = nodeMap.get(edge.toNode);
                if (!fromNode || !toNode) return null;
                const p1 = getPortPosition(fromNode, 'out', edge.fromPort);
                const p2 = getPortPosition(toNode, 'in', edge.toPort);
                const outPortDef = getEffectiveOutputs(fromNode).find(
                  (p) => p.id === edge.fromPort
                );
                const color = PORT_COLOR[outPortDef?.type ?? 'any'];
                const d = bezierPath(p1.x, p1.y, p2.x, p2.y);

                return (
                  <g key={edge.id} className="pointer-events-auto">
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      className={readOnly ? '' : 'cursor-pointer'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEdge(edge.id);
                      }}
                    >
                      {!readOnly && <title>Click to disconnect wire</title>}
                    </path>
                    <path
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={outPortDef?.type === 'exec' ? 2.5 : 2}
                      strokeOpacity={0.85}
                      className="pointer-events-none"
                    />
                  </g>
                );
              })}

              {draggingWire && (
                <path
                  d={bezierPath(
                    draggingWire.startX,
                    draggingWire.startY,
                    draggingWire.curX,
                    draggingWire.curY
                  )}
                  fill="none"
                  stroke={PORT_COLOR[draggingWire.fromType]}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
              )}
            </svg>

            {/* HTML Nodes Layer */}
            {graph.nodes.map((node) => {
              const def = getNodeDefinition(node.type);
              const pos = node.position ?? { x: 48, y: 48 };
              const inputs = getEffectiveInputs(node);
              const outputs = getEffectiveOutputs(node);
              const rowCount = Math.max(inputs.length, outputs.length, 1);
              const isSelected = selectedNodeId === node.id;
              const accent = CATEGORY_ACCENT[def?.category ?? 'flow'];
              const summary = summarizeNode(node);

              return (
                <div
                  key={node.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                    setPaletteOpen(false);
                    if (!readOnly && e.button === 0) {
                      nodeDragRef.current = {
                        nodeId: node.id,
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        origX: pos.x,
                        origY: pos.y,
                      };
                    }
                  }}
                  style={{
                    transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                    width: `${NODE_WIDTH}px`,
                  }}
                  className={`absolute top-0 left-0 rounded-md bg-[#111720] border shadow-lg transition-colors cursor-move ${
                    isSelected
                      ? 'border-[#10B981] ring-1 ring-[#10B981]/50 z-10'
                      : 'border-[#2D3C4E] hover:border-[#475569]'
                  }`}
                >
                  {/* Node Header */}
                  <div
                    style={{
                      height: `${HEADER_H}px`,
                      borderTopColor: accent,
                    }}
                    className="px-2.5 flex items-center justify-between gap-1.5 border-t-2 border-b border-b-[#1F2A38] bg-[#17202B]/80 rounded-t-[5px]"
                  >
                    <span className="text-[11px] font-semibold text-[#E6EDF3] truncate">
                      {def?.label ?? node.type}
                    </span>
                    {summary && (
                      <span className="font-mono text-[10px] text-[#8B98A9] truncate max-w-[82px]">
                        {summary}
                      </span>
                    )}
                  </div>

                  {/* Ports Body */}
                  <div
                    style={{
                      paddingTop: `${BODY_PAD_TOP}px`,
                      paddingBottom: '8px',
                    }}
                    className="relative"
                  >
                    {Array.from({ length: rowCount }).map((_, rowIdx) => {
                      const inPort = inputs[rowIdx];
                      const outPort = outputs[rowIdx];
                      return (
                        <div
                          key={rowIdx}
                          style={{ height: `${PORT_ROW_H}px` }}
                          className="flex items-center justify-between px-2.5 text-[11px]"
                        >
                          {/* Input Pin */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {inPort && (
                              <>
                                <button
                                  type="button"
                                  title={`${inPort.label} (${inPort.type})`}
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    // Clicking an input pin disconnects existing incoming data wires
                                    if (!readOnly && !draggingWire) {
                                      onChange({
                                        ...graph,
                                        edges: graph.edges.filter(
                                          (ed) =>
                                            !(
                                              ed.toNode === node.id &&
                                              ed.toPort === inPort.id
                                            )
                                        ),
                                      });
                                    }
                                  }}
                                  onPointerUp={(e) => {
                                    e.stopPropagation();
                                    handleConnectToInput(
                                      node.id,
                                      inPort.id,
                                      inPort.type
                                    );
                                  }}
                                  style={{
                                    backgroundColor: PORT_COLOR[inPort.type],
                                  }}
                                  className={`-ml-4 w-3 h-3 shrink-0 border-2 border-[#0B0F14] transition-transform hover:scale-125 cursor-crosshair ${
                                    inPort.type === 'exec'
                                      ? 'rotate-45 rounded-[1px]'
                                      : 'rounded-full'
                                  }`}
                                />
                                <span className="text-[#8B98A9] truncate">
                                  {inPort.label}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Output Pin */}
                          <div className="flex items-center gap-1.5 min-w-0 justify-end">
                            {outPort && (
                              <>
                                <span className="text-[#E6EDF3]/90 truncate text-right">
                                  {outPort.label}
                                </span>
                                <button
                                  type="button"
                                  title={`${outPort.label} (${outPort.type})`}
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    if (readOnly) return;
                                    const p = getPortPosition(
                                      node,
                                      'out',
                                      outPort.id
                                    );
                                    setDraggingWire({
                                      fromNode: node.id,
                                      fromPort: outPort.id,
                                      fromType: outPort.type,
                                      startX: p.x,
                                      startY: p.y,
                                      curX: p.x,
                                      curY: p.y,
                                    });
                                  }}
                                  style={{
                                    backgroundColor: PORT_COLOR[outPort.type],
                                  }}
                                  className={`-mr-4 w-3 h-3 shrink-0 border-2 border-[#0B0F14] transition-transform hover:scale-125 cursor-crosshair ${
                                    outPort.type === 'exec'
                                      ? 'rotate-45 rounded-[1px]'
                                      : 'rounded-full'
                                  }`}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Searchable Scope-Filtered Add Node Palette */}
          {paletteOpen && !readOnly && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-3 left-3 z-30 w-64 max-h-[75%] bg-[#111720] border border-[#2D3C4E] rounded-lg shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-2 border-b border-[#1F2A38] flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#8B98A9] shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={paletteSearch}
                  onChange={(e) => setPaletteSearch(e.target.value)}
                  placeholder="Search nodes..."
                  className="flex-1 bg-transparent text-xs text-[#E6EDF3] placeholder:text-[#8B98A9]/70 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPaletteOpen(false)}
                  className="p-0.5 text-[#8B98A9] hover:text-[#E6EDF3] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-2">
                {filteredPalette.map(([cat, defs]) => (
                  <div key={cat}>
                    <div className="px-2 py-1 text-[10px] font-semibold text-[#8B98A9] capitalize">
                      {cat}
                    </div>
                    <div className="space-y-0.5">
                      {defs.map((d) => (
                        <button
                          key={d.type}
                          type="button"
                          onClick={() => handleAddNode(d.type)}
                          className="w-full text-left px-2 py-1.5 rounded text-xs text-[#E6EDF3] hover:bg-[#17202B] flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span className="truncate">{d.label}</span>
                          <span className="font-mono text-[10px] text-[#8B98A9] shrink-0">
                            {d.type.split('.')[1]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {filteredPalette.length === 0 && (
                  <div className="p-3 text-center text-xs text-[#8B98A9]">
                    No matching nodes
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty State Hint */}
          {graph.nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center px-4">
                <p className="text-xs font-medium text-[#8B98A9]">
                  Empty {scope} graph
                </p>
                {!readOnly && (
                  <p className="text-[11px] text-[#8B98A9]/70 mt-1">
                    Click &ldquo;Add Node&rdquo; or right-click anywhere on the canvas to start.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contextual Node Inspector */}
      <NodeInspector
        node={selectedNode}
        scope={scope}
        manifest={manifest}
        cellStateSchema={cellStateSchema}
        readOnly={readOnly}
        onUpdateNode={handleUpdateNodeData}
        onDuplicateNode={handleDuplicateNode}
        onDeleteNode={handleDeleteNode}
      />
    </div>
  );
}
