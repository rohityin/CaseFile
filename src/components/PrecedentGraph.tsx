import { useState, useRef, useMemo } from "react";
import {
  ShieldWarning,
  CheckCircle,
  ArrowsOut,
  Sparkle,
  Eye,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
} from "@phosphor-icons/react";
import type {
  FavorableCase as FavorablePrecedent,
  AdverseCase as AdversePrecedent,
  VerifiedCitation as CitationAudit,
} from "../lib/api";

interface Node {
  id: string;
  title: string;
  citation: string;
  type: "favorable" | "adverse" | "root";
  year: number;
  court: string;
  x: number;
  y: number;
  holding: string;
  importance: number;
}

interface Edge {
  source: string;
  target: string;
  label: "cites" | "distinguishes" | "limits" | "establishes";
}

interface PrecedentGraphProps {
  favorable: FavorablePrecedent[];
  adverse: AdversePrecedent[];
  citations?: CitationAudit[];
  onSelectCase?: (title: string) => void;
}

const CANVAS_WIDTH = 860;
const CANVAS_HEIGHT = 520;
const CX = CANVAS_WIDTH / 2; // 430
const CY = CANVAS_HEIGHT / 2; // 260

function cleanCitation(cite: string): string {
  if (!cite) return "";
  const cleaned = cite.replace(/^unbound\s*\(/i, "").replace(/\)$/, "").trim();
  if (cleaned.length > 26) {
    return `${cleaned.slice(0, 24)}…`;
  }
  return cleaned;
}

export function PrecedentGraph({
  favorable,
  adverse,
  citations = [],
  onSelectCase,
}: PrecedentGraphProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState<"all" | "favorable" | "adverse">("all");
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Synthesize nodes & edges with balanced elliptical distribution
  const { nodes, edges } = useMemo(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Central anchor node (governing legal foundation)
    newNodes.push({
      id: "root-issue",
      title: "Main Law Foundation",
      citation: "18 U.S.C. § 1836 / U.S. Const.",
      type: "root",
      year: 2016,
      court: "Written Federal Law",
      x: CX,
      y: CY,
      holding: "The core federal laws and constitutional rules governing this legal issue.",
      importance: 3,
    });

    const hasFavorable = favorable.length > 0;
    const hasAdverse = adverse.length > 0;

    if (hasFavorable && hasAdverse) {
      // 1. Two-Sided Adversarial Layout:
      // Favorable nodes on LEFT arc (approx 120° to 240°)
      const favCount = favorable.length;
      const favSpan = favCount === 1 ? 0 : Math.min(Math.PI * 0.75, 0.45 * (favCount - 1));
      const favStart = Math.PI - favSpan / 2;
      const favStep = favCount > 1 ? favSpan / (favCount - 1) : 0;

      favorable.forEach((fav, i) => {
        const angle = favCount === 1 ? Math.PI : favStart + i * favStep;
        const radiusX = 220 + (i % 2) * 15;
        const radiusY = 135 + (i % 2) * 10;
        const nodeId = `fav-${fav.id || i}`;

        newNodes.push({
          id: nodeId,
          title: fav.title,
          citation: fav.citation,
          type: "favorable",
          year: 2018 + i * 2,
          court: fav.citation.includes("9th") ? "9th Cir." : "Federal Appellate",
          x: CX + Math.cos(angle) * radiusX,
          y: CY + Math.sin(angle) * radiusY,
          holding: fav.holding,
          importance: 2,
        });

        newEdges.push({
          source: nodeId,
          target: "root-issue",
          label: i % 2 === 0 ? "establishes" : "cites",
        });
      });

      // Adverse nodes on RIGHT arc (approx -60° to +60°)
      const advCount = adverse.length;
      const advSpan = advCount === 1 ? 0 : Math.min(Math.PI * 0.75, 0.45 * (advCount - 1));
      const advStart = -advSpan / 2;
      const advStep = advCount > 1 ? advSpan / (advCount - 1) : 0;

      adverse.forEach((adv, i) => {
        const angle = advCount === 1 ? 0 : advStart + i * advStep;
        const radiusX = 220 + (i % 2) * 15;
        const radiusY = 135 + (i % 2) * 10;
        const nodeId = `adv-${adv.id || i}`;

        newNodes.push({
          id: nodeId,
          title: adv.title,
          citation: adv.citation,
          type: "adverse",
          year: 2020 + i,
          court: "Circuit Precedent",
          x: CX + Math.cos(angle) * radiusX,
          y: CY + Math.sin(angle) * radiusY,
          holding: adv.opposingArgument,
          importance: 2,
        });

        newEdges.push({
          source: nodeId,
          target: "root-issue",
          label: "limits",
        });

        // Distinguish against corresponding favorable precedent
        const targetFav = `fav-${favorable[i % favorable.length].id || (i % favorable.length)}`;
        newEdges.push({
          source: nodeId,
          target: targetFav,
          label: "distinguishes",
        });
      });
    } else if (hasAdverse) {
      // 2. Only Adverse nodes present: distribute in a balanced elliptical orbit
      const count = adverse.length;
      adverse.forEach((adv, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const radiusX = 230 + (i % 2) * 20;
        const radiusY = 140 + (i % 2) * 10;
        const nodeId = `adv-${adv.id || i}`;

        newNodes.push({
          id: nodeId,
          title: adv.title,
          citation: adv.citation,
          type: "adverse",
          year: 2020 + i,
          court: "Circuit Precedent",
          x: CX + Math.cos(angle) * radiusX,
          y: CY + Math.sin(angle) * radiusY,
          holding: adv.opposingArgument,
          importance: 2,
        });

        newEdges.push({
          source: nodeId,
          target: "root-issue",
          label: "limits",
        });
      });
    } else if (hasFavorable) {
      // 3. Only Favorable nodes present: distribute in a balanced elliptical orbit
      const count = favorable.length;
      favorable.forEach((fav, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const radiusX = 230 + (i % 2) * 20;
        const radiusY = 140 + (i % 2) * 10;
        const nodeId = `fav-${fav.id || i}`;

        newNodes.push({
          id: nodeId,
          title: fav.title,
          citation: fav.citation,
          type: "favorable",
          year: 2018 + i * 2,
          court: fav.citation.includes("9th") ? "9th Cir." : "Federal Appellate",
          x: CX + Math.cos(angle) * radiusX,
          y: CY + Math.sin(angle) * radiusY,
          holding: fav.holding,
          importance: 2,
        });

        newEdges.push({
          source: nodeId,
          target: "root-issue",
          label: i % 2 === 0 ? "establishes" : "cites",
        });
      });
    }

    return { nodes: newNodes, edges: newEdges };
  }, [favorable, adverse]);

  const isVerifiedAuthority = useMemo(() => {
    if (!selectedNode || selectedNode.type === "root") return false;
    return citations.some(
      (c) =>
        c.status === "verified" &&
        (c.caseTitle?.toLowerCase().includes(selectedNode.title.toLowerCase()) ||
          selectedNode.title.toLowerCase().includes(c.caseTitle?.toLowerCase()))
    );
  }, [selectedNode, citations]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".graph-node-group") || target.closest(".graph-node-card")) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 1.12 : 0.88;
    setZoom((prev) => {
      const next = prev * zoomDelta;
      return Math.min(2.5, Math.max(0.4, Number(next.toFixed(2))));
    });
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(2.5, Number((prev * 1.2).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.4, Number((prev / 1.2).toFixed(2))));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  const filteredNodes = nodes.filter((n) => {
    if (filter === "favorable") return n.type === "favorable" || n.type === "root";
    if (filter === "adverse") return n.type === "adverse" || n.type === "root";
    return true;
  });

  return (
    <div className="precedent-graph-container">
      {/* Top Toolbar */}
      <div className="graph-toolbar">
        <div className="graph-title-block">
          <h4 className="graph-heading">
            <Sparkle size={15} weight="fill" color="var(--accent)" /> Case Network Map
          </h4>
          <span className="graph-subtitle">
            See how court cases connect, support each other, or argue the other side
          </span>
        </div>

        <div className="graph-controls">
          <div className="segmented-control seg-sm">
            <button
              type="button"
              className={`seg-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All ({nodes.length})
            </button>
            <button
              type="button"
              className={`seg-btn ${filter === "favorable" ? "active" : ""}`}
              onClick={() => setFilter("favorable")}
            >
              <CheckCircle size={12} weight="bold" color="var(--accent)" /> Helpful Cases
            </button>
            <button
              type="button"
              className={`seg-btn ${filter === "adverse" ? "active" : ""}`}
              onClick={() => setFilter("adverse")}
            >
              <ShieldWarning size={12} weight="bold" color="var(--warn)" /> Opposing Cases
            </button>
          </div>

          <div className="graph-zoom-group">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleZoomIn}
              title="Zoom In"
              aria-label="Zoom in"
            >
              <MagnifyingGlassPlus size={13} />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleZoomOut}
              title="Zoom Out"
              aria-label="Zoom out"
            >
              <MagnifyingGlassMinus size={13} />
            </button>
            <span className="graph-zoom-level">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={resetView}
              title="Reset Pan & Zoom"
            >
              <ArrowsOut size={13} /> Reset View
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        className="graph-canvas-wrap"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          className="graph-svg"
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          <defs>
            {/* Arrowhead markers */}
            <marker
              id="arrow-cites"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6aab8a" />
            </marker>
            <marker
              id="arrow-distinguishes"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#c4a35a" />
            </marker>
            {/* Grid Pattern */}
            <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(255, 255, 255, 0.03)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* Background Grid */}
          <rect width="100%" height="100%" fill="url(#graph-grid)" />

          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          >
            {/* Edges */}
            {edges.map((edge, idx) => {
              const sourceNode = filteredNodes.find((n) => n.id === edge.source);
              const targetNode = filteredNodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const isAdverseEdge = edge.label === "distinguishes" || edge.label === "limits";
              const strokeColor = isAdverseEdge
                ? "rgba(196, 163, 90, 0.45)"
                : "rgba(106, 171, 138, 0.45)";
              const markerEnd = isAdverseEdge
                ? "url(#arrow-distinguishes)"
                : "url(#arrow-cites)";

              return (
                <g key={`edge-${idx}`}>
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={strokeColor}
                    strokeWidth={isAdverseEdge ? 1.5 : 1.2}
                    strokeDasharray={edge.label === "distinguishes" ? "4 3" : undefined}
                    markerEnd={markerEnd}
                  />
                  {/* Midpoint Label */}
                  <text
                    x={(sourceNode.x + targetNode.x) / 2}
                    y={(sourceNode.y + targetNode.y) / 2 - 4}
                    fill="var(--text-mute)"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isFavorable = node.type === "favorable";
              const isAdverse = node.type === "adverse";
              const isRoot = node.type === "root";

              let fillColor = "#161b22";
              let strokeColor = "#3d4654";
              let glowColor = "transparent";
              let radius = 18;

              if (isRoot) {
                fillColor = "#1a251e";
                strokeColor = "var(--accent)";
                glowColor = "rgba(106, 171, 138, 0.35)";
                radius = 24;
              } else if (isFavorable) {
                fillColor = "#10231b";
                strokeColor = "#6aab8a";
                glowColor = "rgba(106, 171, 138, 0.25)";
                radius = 20;
              } else if (isAdverse) {
                fillColor = "#261e14";
                strokeColor = "#c4a35a";
                glowColor = "rgba(196, 163, 90, 0.25)";
                radius = 20;
              }

              if (isSelected) {
                strokeColor = "#ffffff";
                glowColor = "rgba(255, 255, 255, 0.4)";
                radius += 3;
              }

              const displayCitation = cleanCitation(node.citation);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="graph-node-group"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node);
                    if (onSelectCase && !isRoot) onSelectCase(node.title);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {/* Subtle outer aura */}
                  <circle
                    r={radius + 6}
                    fill={glowColor}
                    className="node-aura"
                  />
                  {/* Core Node circle */}
                  <circle
                    r={radius}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 2.5 : 1.8}
                  />
                  {/* Inner glyph or symbol */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={
                      isRoot
                        ? "var(--accent)"
                        : isFavorable
                        ? "#72ba97"
                        : isAdverse
                        ? "#dbc07a"
                        : "#fff"
                    }
                    fontSize={isRoot ? 13 : 11}
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                  >
                    {isRoot ? "§" : isFavorable ? "F" : isAdverse ? "A" : "•"}
                  </text>
                  {/* Node Label underneath */}
                  <text
                    y={radius + 14}
                    textAnchor="middle"
                    fill={isSelected ? "#ffffff" : "var(--text)"}
                    fontSize="10"
                    fontWeight={isSelected ? "600" : "500"}
                    className="graph-node-label"
                  >
                    {node.title.length > 22 ? `${node.title.slice(0, 20)}…` : node.title}
                  </text>
                  {displayCitation && (
                    <text
                      y={radius + 25}
                      textAnchor="middle"
                      fill="var(--text-mute)"
                      fontSize="8.5"
                      fontFamily="var(--font-mono)"
                    >
                      {displayCitation}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Node Details Card */}
        {selectedNode && (
          <div className="graph-node-card">
            <div className="node-card-head">
              <span className={`node-card-badge ${selectedNode.type}`}>
                {selectedNode.type === "root"
                  ? "Law Foundation"
                  : selectedNode.type === "favorable"
                  ? "Case Supporting You"
                  : "Opposing Case (Other Side)"}
              </span>
              {isVerifiedAuthority && (
                <span
                  className="node-card-badge favorable"
                  title="Verified against official court dockets"
                >
                  <CheckCircle size={12} weight="fill" /> Verified
                </span>
              )}
              <button
                type="button"
                className="btn-icon"
                onClick={() => setSelectedNode(null)}
              >
                ✕
              </button>
            </div>
            <h5 className="node-card-title">{selectedNode.title}</h5>
            <div className="node-card-citation">{selectedNode.citation}</div>
            <p className="node-card-holding">{selectedNode.holding}</p>
            <div className="node-card-actions">
              <span className="node-card-meta">Court: {selectedNode.court}</span>
              {onSelectCase && selectedNode.type !== "root" && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onSelectCase(selectedNode.title)}
                >
                  <Eye size={12} /> Read Full Case
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="graph-legend">
        <div className="legend-item">
          <span className="legend-dot root" />
          <span>Main Law (§ 1836 / Legal Foundation)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot favorable" />
          <span>Cases That Support You</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot adverse" />
          <span>Opposing Cases (The Other Side)</span>
        </div>
        <div className="legend-item">
          <span className="legend-line dashed" />
          <span>Shows Why Opposing Case Differs</span>
        </div>
      </div>
    </div>
  );
}
