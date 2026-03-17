import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { X, Search, ZoomIn, ZoomOut, RotateCcw, Minus, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProjectGraph, GraphNode, GraphEdge } from '@/lib/api';
import { fetchFileContent, searchProjectContent } from '@/lib/api';
import { MarkdownView } from '@/components/MarkdownView';
import { cn } from '@/lib/utils';
import { filterGraphBySearch } from '@/lib/graphFilter';
import { computeViewBox, clampZoom, WIDTH, HEIGHT, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '@/lib/graphZoom';

interface GraphPanelProps {
  projectName: string;
  projectId: string;
  graph: ProjectGraph | null;
  loading: boolean;
  openFilePaths: Set<string>;
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
  getZoom: (projectId: string, filePath: string) => number;
  onZoomChange: (projectId: string, filePath: string, delta: number) => void;
  onZoomReset: (projectId: string, filePath: string) => void;
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

interface PanState {
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
}

interface PreviewState {
  nodeId: string;
  filePath: string;
  label: string;
  content: string | null;
  loading: boolean;
  pos: { x: number; y: number };
}

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
      node.x = Math.min(WIDTH - 30, Math.max(30, node.x));
      node.y = Math.min(HEIGHT - 30, Math.max(30, node.y));
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
  getZoom,
  onZoomChange,
  onZoomReset: onZoomResetProp,
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
  const [animTime, setAnimTime] = useState(0);
  const animRef = useRef<number>(0);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panStateRef = useRef<PanState | null>(null);

  useEffect(() => {
    setDraggedPositions(new Map());
    setDragState(null);
    setSelectedNodeId(null);
    setPreview(null);
    setSearchQuery('');
    setSearchMatches(null);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [graph]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchMatches(null); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const res = await searchProjectContent(projectId, searchQuery.trim());
        if (!cancelled) setSearchMatches(new Set(res.results.map(r => r.filePath)));
      } catch {
        if (!cancelled) setSearchMatches(new Set());
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(id); };
  }, [projectId, searchQuery]);

  useEffect(() => {
    if (dragState) return;
    let running = true;
    const tick = (t: number) => {
      if (running) {
        setAnimTime(t);
        animRef.current = requestAnimationFrame(tick);
      }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [dragState]);

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

  const nodeIndexById = useMemo(
    () => new Map(effectiveNodes.map((node, i) => [node.id, i])),
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

  const selectedNodeVisible = useMemo(
    () => selectedNodeId !== null && (filteredGraph?.nodes.some(n => n.id === selectedNodeId) ?? false),
    [selectedNodeId, filteredGraph],
  );

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
  }, []);

  const handlePreviewClose = useCallback(() => {
    setPreview(null);
  }, []);

  const dragStateRef = useRef<DragState | null>(null);
  dragStateRef.current = dragState;

  const handleSVGMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const ps = panStateRef.current;
      if (ps) {
        const coords = getSVGCoords(e, svgRef);
        if (!coords) return;
        isDragging.current = true;
        setPanOffset({
          x: ps.startPanX - (coords.x - ps.startX),
          y: ps.startPanY - (coords.y - ps.startY),
        });
        return;
      }
      const ds = dragStateRef.current;
      if (!ds) return;
      const coords = getSVGCoords(e, svgRef);
      if (!coords) return;
      isDragging.current = true;
      const newX = Math.min(WIDTH + 60, Math.max(-60, ds.startNodeX + coords.x - ds.startSVGX));
      const newY = Math.min(HEIGHT + 60, Math.max(-60, ds.startNodeY + coords.y - ds.startSVGY));

      setDraggedPositions((prev) => new Map(prev).set(ds.nodeId, { x: newX, y: newY }));
    },
    [],
  );

  const handleSVGMouseUp = useCallback(() => {
    panStateRef.current = null;
    setDragState(null);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => clampZoom(z + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => clampZoom(z - ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const svgPt = pt.matrixTransform(ctm.inverse());

      setZoom((prevZoom) => {
        const newZoom = clampZoom(prevZoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
        if (newZoom === prevZoom) return prevZoom;
        setPanOffset((prevPan) => {
          const cx = WIDTH / 2 + prevPan.x;
          const cy = HEIGHT / 2 + prevPan.y;
          const newCx = svgPt.x + (cx - svgPt.x) * (prevZoom / newZoom);
          const newCy = svgPt.y + (cy - svgPt.y) * (prevZoom / newZoom);
          return { x: newCx - WIDTH / 2, y: newCy - HEIGHT / 2 };
        });
        return newZoom;
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

  const viewBox = useMemo(() => computeViewBox(zoom, panOffset), [zoom, panOffset]);

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
        <div className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.08),_transparent_32%)]">
          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className={cn(
              'h-full w-full select-none',
              dragState || panStateRef.current ? 'cursor-grabbing' : '',
            )}
            overflow="visible"
            role="img"
            aria-label={`${projectName} markdown graph`}
            onMouseMove={handleSVGMouseMove}
            onMouseUp={handleSVGMouseUp}
            onMouseLeave={handleSVGMouseUp}
          >
            <defs>
              <filter id="node-glow">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <radialGradient id="grad-blue" cx="40%" cy="35%">
                <stop offset="0%" stopColor="rgba(96,165,250,0.8)"/>
                <stop offset="100%" stopColor="rgba(59,130,246,0.3)"/>
              </radialGradient>
              <radialGradient id="grad-pink" cx="40%" cy="35%">
                <stop offset="0%" stopColor="rgba(244,114,182,0.7)"/>
                <stop offset="100%" stopColor="rgba(244,114,182,0.25)"/>
              </radialGradient>
              <radialGradient id="grad-default" cx="40%" cy="35%">
                <stop offset="0%" stopColor="rgba(148,163,184,0.6)"/>
                <stop offset="100%" stopColor="rgba(100,116,139,0.25)"/>
              </radialGradient>
            </defs>
            <rect
              x={viewBox.x - viewBox.w} y={viewBox.y - viewBox.h}
              width={viewBox.w * 3} height={viewBox.h * 3}
              fill="transparent"
              onMouseDown={(e) => {
                if (e.shiftKey || e.button === 1) {
                  e.preventDefault();
                  const coords = getSVGCoords(e, svgRef);
                  if (!coords) return;
                  panStateRef.current = {
                    startX: coords.x,
                    startY: coords.y,
                    startPanX: panOffset.x,
                    startPanY: panOffset.y,
                  };
                } else {
                  setSelectedNodeId(null);
                }
              }}
            />

            {filteredGraph.edges.map((edge) => {
              const source = effectiveNodesById.get(edge.source);
              const target = effectiveNodesById.get(edge.target);
              if (!source || !target) return null;
              const si = nodeIndexById.get(edge.source) ?? 0;
              const ti = nodeIndexById.get(edge.target) ?? 0;
              const sx = dragState?.nodeId === edge.source ? source.x : source.x + Math.sin(animTime * 0.001 + si * 0.7) * 1.5;
              const sy = dragState?.nodeId === edge.source ? source.y : source.y + Math.cos(animTime * 0.0012 + si * 0.5) * 1.2;
              const tx = dragState?.nodeId === edge.target ? target.x : target.x + Math.sin(animTime * 0.001 + ti * 0.7) * 1.5;
              const ty = dragState?.nodeId === edge.target ? target.y : target.y + Math.cos(animTime * 0.0012 + ti * 0.5) * 1.2;
              const edgeKey = `${edge.source}-${edge.target}-${edge.kind}-${edge.rawTarget}`;
              const isConnected = selection?.connectedEdgeKeys.has(edgeKey) ?? false;
              const dimmed = selection !== null && !isConnected;
              return (
                <line
                  key={edgeKey}
                  x1={sx} y1={sy}
                  x2={tx} y2={ty}
                  stroke={isConnected ? 'rgba(96,165,250,1.0)' : edge.kind === 'wiki' ? 'rgba(96,165,250,0.7)' : 'rgba(148,163,184,0.55)'}
                  strokeWidth={isConnected ? 2.5 : edge.kind === 'wiki' ? 1.8 : 1.2}
                  opacity={dimmed ? 0.08 : 1}
                />
              );
            })}

            {effectiveNodes.map((node, idx) => {
              const isOpen = node.filePath ? openFilePaths.has(node.filePath) : false;
              const isSelected = node.id === selectedNodeId;
              const isNeighbor = selection?.connectedNodeIds.has(node.id) ?? false;
              const dimmed = selection !== null && !isSelected && !isNeighbor;
              const radius = isSelected ? 22 : node.dangling ? 14 : isOpen ? 18 : 16;
              const fill = isSelected
                ? 'url(#grad-blue)'
                : node.dangling ? 'url(#grad-pink)'
                : isOpen ? 'url(#grad-blue)' : 'url(#grad-default)';
              const stroke = isSelected
                ? 'rgba(96,165,250,1.0)'
                : isNeighbor && selection ? 'rgba(99,155,246,0.85)'
                : node.dangling ? 'rgba(244,114,182,0.9)'
                : isOpen ? 'rgba(96,165,250,1.0)' : 'rgba(148,163,184,0.7)';

              const isDragTarget = dragState?.nodeId === node.id;
              const floatX = isDragTarget ? node.x : node.x + Math.sin(animTime * 0.001 + idx * 0.7) * 1.5;
              const floatY = isDragTarget ? node.y : node.y + Math.cos(animTime * 0.0012 + idx * 0.5) * 1.2;

              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  opacity={dimmed ? 0.18 : 1}
                  className={cn(
                    'transition-opacity duration-150',
                    node.filePath
                      ? isDragTarget ? 'cursor-grabbing' : 'cursor-grab'
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
                      cx={floatX} cy={floatY} r={radius + 8}
                      fill="rgba(59,130,246,0.12)"
                      stroke="rgba(59,130,246,0.3)"
                      strokeWidth={1}
                    />
                  )}
                  <circle
                    cx={floatX} cy={floatY} r={radius}
                    fill={fill} stroke={stroke}
                    strokeWidth={isSelected ? 2.5 : node.dangling ? 1.8 : 1.5}
                    filter="url(#node-glow)"
                  />
                  <text
                    x={floatX} y={floatY + radius + 16}
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

          {/* Hover preview modal */}
          {preview && (
            <NodePreview
              preview={preview}
              projectId={projectId}
              zoom={getZoom(projectId, preview.filePath)}
              onZoomIn={() => onZoomChange(projectId, preview.filePath, +0.1)}
              onZoomOut={() => onZoomChange(projectId, preview.filePath, -0.1)}
              onZoomReset={() => onZoomResetProp(projectId, preview.filePath)}
              onClose={handlePreviewClose}
            />
          )}

          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md border border-border bg-background/90 px-1.5 py-1 shadow-sm backdrop-blur-sm">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="min-w-[3rem] text-center text-xs font-medium text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleZoomReset}
              aria-label="Reset zoom"
              title="Reset zoom"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {selectedNodeVisible && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Click node to select · Double-click to open file · Click background to clear
        </div>
      )}
    </div>
  );
}

type ModalState = 'normal' | 'minimized' | 'maximized';

function NodePreview({
  preview,
  zoom,
  projectId,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClose,
}: {
  preview: PreviewState;
  projectId: string;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClose: () => void;
}) {
  const [modalState, setModalState] = useState<ModalState>('normal');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (modalState === 'maximized') setModalState('normal');
        else onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, modalState]);

  const cardClass = cn(
    'flex flex-col border border-border bg-background shadow-2xl',
    modalState === 'normal' && 'h-[80vh] w-[75vw] max-w-4xl rounded-lg',
    modalState === 'minimized' && 'fixed bottom-4 left-1/2 -translate-x-1/2 w-[75vw] max-w-4xl rounded-lg h-auto',
    modalState === 'maximized' && 'fixed inset-0 h-screen w-screen rounded-none',
  );

  return (
    <>
      {modalState !== 'minimized' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={onClose}
        >
          <div className={cardClass} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
              <span className="truncate text-sm font-medium">{preview.label}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onZoomOut}
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <ZoomOut className="size-4" />
                </Button>
                <button
                  className="min-w-[3rem] text-center text-xs text-muted-foreground tabular-nums select-none"
                  onDoubleClick={onZoomReset}
                  title="Double-click to reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onZoomIn}
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  <ZoomIn className="size-4" />
                </Button>
                <div className="mx-1 h-4 w-px bg-border" />
                <Button variant="ghost" size="icon-sm" onClick={() => setModalState('minimized')} aria-label="Minimize preview" title="Minimize">
                  <Minus className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setModalState(modalState === 'maximized' ? 'normal' : 'maximized')} aria-label={modalState === 'maximized' ? 'Restore preview' : 'Maximize preview'} title={modalState === 'maximized' ? 'Restore' : 'Maximize'}>
                  {modalState === 'maximized' ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close preview" title="Close">
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
              {preview.loading ? (
                <p className="text-sm text-muted-foreground">Loading preview…</p>
              ) : preview.content !== null ? (
                <MarkdownView
                  content={preview.content}
                  zoom={zoom}
                  projectId={projectId}
                  onLinkClick={noop}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
      {modalState === 'minimized' && (
        <div className={cn(cardClass, 'z-50')} onClick={(e) => e.stopPropagation()}>
          <div className="flex shrink-0 items-center justify-between px-4 py-2">
            <span className="truncate text-sm font-medium">{preview.label}</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setModalState('normal')}
                aria-label="Restore preview"
                title="Restore"
              >
                <Maximize2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close preview"
                title="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
