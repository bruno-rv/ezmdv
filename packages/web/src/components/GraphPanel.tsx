import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProjectGraph, GraphNode, GraphEdge } from '@/lib/api';
import { fetchFileContent, searchProjectContent } from '@/lib/api';
import { MarkdownView } from '@/components/MarkdownView';
import { cn } from '@/lib/utils';
import { filterGraphBySearch } from '@/lib/graphFilter';

interface GraphPanelProps {
  projectName: string;
  projectId: string;
  graph: ProjectGraph | null;
  loading: boolean;
  openFilePaths: Set<string>;
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

interface DragState {
  nodeId: string;
  startSVGX: number;
  startSVGY: number;
  startNodeX: number;
  startNodeY: number;
}

interface PreviewState {
  nodeId: string;
  filePath: string;
  label: string;
  content: string | null;
  loading: boolean;
  pos: { x: number; y: number };
}

const WIDTH = 1200;
const HEIGHT = 760;
const HOVER_DELAY_MS = 5000;

function buildLayout(nodes: GraphNode[], edges: GraphEdge[]): PositionedNode[] {
  if (nodes.length === 0) return [];

  const positioned = nodes.map((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    return {
      ...node,
      x: WIDTH / 2 + Math.cos(angle) * Math.min(280, 40 * nodes.length),
      y: HEIGHT / 2 + Math.sin(angle) * Math.min(220, 32 * nodes.length),
    };
  });

  const nodeIndex = new Map(positioned.map((node, index) => [node.id, index]));

  for (let iteration = 0; iteration < 140; iteration++) {
    const next = positioned.map((node) => ({ ...node }));

    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        const dx = next[j].x - next[i].x;
        const dy = next[j].y - next[i].y;
        const distanceSq = dx * dx + dy * dy + 0.01;
        const force = Math.min(3800 / distanceSq, 18);
        const distance = Math.sqrt(distanceSq);
        const offsetX = (dx / distance) * force;
        const offsetY = (dy / distance) * force;
        next[i].x -= offsetX;
        next[i].y -= offsetY;
        next[j].x += offsetX;
        next[j].y += offsetY;
      }
    }

    for (const edge of edges) {
      const si = nodeIndex.get(edge.source);
      const ti = nodeIndex.get(edge.target);
      if (si === undefined || ti === undefined) continue;
      const source = next[si];
      const target = next[ti];
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const desired = edge.kind === 'wiki' ? 150 : 120;
      const spring = (distance - desired) * 0.012;
      const offsetX = (dx / distance) * spring;
      const offsetY = (dy / distance) * spring;
      source.x += offsetX;
      source.y += offsetY;
      target.x -= offsetX;
      target.y -= offsetY;
    }

    for (const node of next) {
      node.x += (WIDTH / 2 - node.x) * 0.014;
      node.y += (HEIGHT / 2 - node.y) * 0.014;
      node.x = Math.min(WIDTH - 70, Math.max(70, node.x));
      node.y = Math.min(HEIGHT - 70, Math.max(70, node.y));
    }

    for (let i = 0; i < positioned.length; i++) {
      positioned[i].x = next[i].x;
      positioned[i].y = next[i].y;
    }
  }

  return positioned;
}

function getSVGCoords(
  e: React.MouseEvent,
  svgRef: React.RefObject<SVGSVGElement | null>,
): { x: number; y: number } | null {
  const svg = svgRef.current;
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const svgPt = pt.matrixTransform(ctm.inverse());
  return { x: svgPt.x, y: svgPt.y };
}

const noop = () => {};

export function GraphPanel({
  projectName,
  projectId,
  graph,
  loading,
  openFilePaths,
  onClose,
  onOpenFile,
}: GraphPanelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [draggedPositions, setDraggedPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<Set<string> | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setDraggedPositions(new Map());
    setDragState(null);
    setSelectedNodeId(null);
    setPreview(null);
    setSearchQuery('');
    setSearchMatches(null);
  }, [graph]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchMatches(null); return; }
    let cancelled = false;
    setSearching(true);
    const id = setTimeout(async () => {
      const res = await searchProjectContent(projectId, searchQuery.trim());
      if (!cancelled) setSearchMatches(new Set(res.results.map(r => r.filePath)));
      if (!cancelled) setSearching(false);
    }, 200);
    return () => { cancelled = true; clearTimeout(id); setSearching(false); };
  }, [projectId, searchQuery]);

  const filteredGraph = useMemo(() => filterGraphBySearch(graph, searchMatches), [graph, searchMatches]);

  const positionedNodes = useMemo(
    () => buildLayout(filteredGraph?.nodes ?? [], filteredGraph?.edges ?? []),
    [filteredGraph],
  );

  const effectiveNodes = useMemo(
    () =>
      positionedNodes.map((node) => {
        const override = draggedPositions.get(node.id);
        return override ? { ...node, ...override } : node;
      }),
    [positionedNodes, draggedPositions],
  );

  const effectiveNodesById = useMemo(
    () => new Map(effectiveNodes.map((node) => [node.id, node])),
    [effectiveNodes],
  );

  const selection = useMemo(() => {
    if (!selectedNodeId || !filteredGraph) return null;
    const connectedNodeIds = new Set<string>([selectedNodeId]);
    const connectedEdgeKeys = new Set<string>();
    for (const edge of filteredGraph.edges) {
      if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
        connectedEdgeKeys.add(`${edge.source}-${edge.target}-${edge.kind}-${edge.rawTarget}`);
      }
    }
    return { connectedNodeIds, connectedEdgeKeys };
  }, [selectedNodeId, filteredGraph]);

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      const coords = getSVGCoords(e, svgRef);
      if (!coords) return;
      isDragging.current = false;
      const effective = effectiveNodesById.get(nodeId);
      if (!effective) return;
      setDragState({
        nodeId,
        startSVGX: coords.x,
        startSVGY: coords.y,
        startNodeX: effective.x,
        startNodeY: effective.y,
      });
    },
    [effectiveNodesById],
  );

  const handleNodeMouseEnter = useCallback(
    (nodeId: string, filePath: string | null | undefined, label: string, clientX: number, clientY: number) => {
      if (!filePath) return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(async () => {
        setPreview({ nodeId, filePath, label, content: null, loading: true, pos: { x: clientX, y: clientY } });
        try {
          const content = await fetchFileContent(projectId, filePath);
          setPreview((prev) =>
            prev?.nodeId === nodeId ? { ...prev, content, loading: false } : prev,
          );
        } catch {
          setPreview(null);
        }
      }, HOVER_DELAY_MS);
    },
    [projectId],
  );

  const handleNodeMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setPreview(null);
  }, []);

  const handleSVGMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState) return;
      const coords = getSVGCoords(e, svgRef);
      if (!coords) return;
      isDragging.current = true;
      const newX = Math.min(WIDTH - 70, Math.max(70, dragState.startNodeX + coords.x - dragState.startSVGX));
      const newY = Math.min(HEIGHT - 70, Math.max(70, dragState.startNodeY + coords.y - dragState.startSVGY));
      setDraggedPositions((prev) => new Map(prev).set(dragState.nodeId, { x: newX, y: newY }));
    },
    [dragState],
  );

  const handleSVGMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{projectName} graph</p>
          <p className="text-xs text-muted-foreground">
            {searchMatches !== null
              ? <>{filteredGraph?.nodes.length ?? 0} / {graph?.nodes.length ?? 0} nodes</>
              : <>{graph?.nodes.length ?? 0} nodes · {graph?.edges.length ?? 0} links</>
            }
            {selectedNodeId && (
              <span className="ml-2 text-primary">
                · {selection?.connectedNodeIds.size ? selection.connectedNodeIds.size - 1 : 0} connections
              </span>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close graph"
          title="Close graph"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="border-b border-border px-4 py-2">
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter nodes by content..."
            className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none ring-0 transition-colors focus:border-primary"
          />
        </label>
        {searching && (
          <p className="mt-1 text-xs text-muted-foreground">Searching…</p>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Building graph...</p>
        </div>
      ) : !graph || graph.nodes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No markdown links found in this project yet.
          </p>
        </div>
      ) : !filteredGraph || filteredGraph.nodes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No nodes match your search.
          </p>
        </div>
      ) : (
        <div className="relative flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.08),_transparent_32%)] p-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className={cn(
              'min-h-[680px] min-w-[960px] select-none',
              dragState ? 'cursor-grabbing' : '',
            )}
            role="img"
            aria-label={`${projectName} markdown graph`}
            onMouseMove={handleSVGMouseMove}
            onMouseUp={handleSVGMouseUp}
            onMouseLeave={handleSVGMouseUp}
          >
            <rect
              x={0} y={0} width={WIDTH} height={HEIGHT}
              fill="transparent"
              onClick={() => setSelectedNodeId(null)}
            />

            {filteredGraph.edges.map((edge) => {
              const source = effectiveNodesById.get(edge.source);
              const target = effectiveNodesById.get(edge.target);
              if (!source || !target) return null;
              const edgeKey = `${edge.source}-${edge.target}-${edge.kind}-${edge.rawTarget}`;
              const isConnected = selection?.connectedEdgeKeys.has(edgeKey) ?? false;
              const dimmed = selection !== null && !isConnected;
              return (
                <line
                  key={edgeKey}
                  x1={source.x} y1={source.y}
                  x2={target.x} y2={target.y}
                  stroke={isConnected ? 'rgba(59,130,246,0.9)' : edge.kind === 'wiki' ? 'rgba(59,130,246,0.5)' : 'rgba(148,163,184,0.4)'}
                  strokeWidth={isConnected ? 2.5 : edge.kind === 'wiki' ? 1.8 : 1.2}
                  opacity={dimmed ? 0.08 : 1}
                />
              );
            })}

            {effectiveNodes.map((node) => {
              const isOpen = node.filePath ? openFilePaths.has(node.filePath) : false;
              const isSelected = node.id === selectedNodeId;
              const isNeighbor = selection?.connectedNodeIds.has(node.id) ?? false;
              const dimmed = selection !== null && !isSelected && !isNeighbor;
              const radius = isSelected ? 22 : node.dangling ? 14 : isOpen ? 18 : 16;
              const fill = isSelected
                ? 'rgba(59,130,246,0.45)'
                : node.dangling ? 'rgba(244,114,182,0.18)'
                : isOpen ? 'rgba(59,130,246,0.24)' : 'rgba(15,23,42,0.14)';
              const stroke = isSelected
                ? 'rgba(59,130,246,1.0)'
                : isNeighbor && selection ? 'rgba(99,155,246,0.85)'
                : node.dangling ? 'rgba(244,114,182,0.7)'
                : isOpen ? 'rgba(59,130,246,0.9)' : 'rgba(148,163,184,0.55)';

              return (
                <g
                  key={node.id}
                  opacity={dimmed ? 0.18 : 1}
                  className={cn(
                    'transition-opacity duration-150',
                    node.filePath
                      ? dragState?.nodeId === node.id ? 'cursor-grabbing' : 'cursor-grab'
                      : 'cursor-default',
                  )}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onMouseEnter={(e) => handleNodeMouseEnter(node.id, node.filePath, node.label, e.clientX, e.clientY)}
                  onMouseLeave={handleNodeMouseLeave}
                  onClick={() => {
                    if (isDragging.current) return;
                    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
                  }}
                  onDoubleClick={() => {
                    if (node.filePath) onOpenFile(node.filePath);
                  }}
                >
                  {isSelected && (
                    <circle
                      cx={node.x} cy={node.y} r={radius + 8}
                      fill="rgba(59,130,246,0.12)"
                      stroke="rgba(59,130,246,0.3)"
                      strokeWidth={1}
                    />
                  )}
                  <circle
                    cx={node.x} cy={node.y} r={radius}
                    fill={fill} stroke={stroke}
                    strokeWidth={isSelected ? 2.5 : node.dangling ? 1.8 : 1.5}
                  />
                  <text
                    x={node.x} y={node.y + radius + 16}
                    textAnchor="middle"
                    className={cn('text-[12px] font-medium', isSelected ? 'fill-primary' : 'fill-foreground')}
                    fontWeight={isSelected ? 600 : isNeighbor && selection ? 500 : 400}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover preview */}
          {preview && (
            <NodePreview preview={preview} />
          )}
        </div>
      )}

      {selectedNodeId && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Click node to select · Double-click to open file · Click background to clear
        </div>
      )}
    </div>
  );
}

function NodePreview({ preview }: { preview: PreviewState }) {
  // Clamp the card so it stays within the viewport
  const CARD_W = 360;
  const CARD_H = 280;
  const OFFSET = 16;
  const left = Math.min(preview.pos.x + OFFSET, window.innerWidth - CARD_W - 8);
  const top = Math.min(preview.pos.y - OFFSET, window.innerHeight - CARD_H - 8);

  return (
    <div
      className="pointer-events-none fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
      style={{ left, top, width: CARD_W, maxHeight: CARD_H }}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="truncate text-xs font-semibold text-foreground">{preview.label}</span>
      </div>
      <div className="flex-1 overflow-hidden px-3 py-2">
        {preview.loading ? (
          <p className="text-xs text-muted-foreground">Loading preview…</p>
        ) : preview.content !== null ? (
          <div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden text-xs [&>*:first-child]:mt-0">
            <MarkdownView
              content={preview.content.slice(0, 3000)}
              onLinkClick={noop}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
