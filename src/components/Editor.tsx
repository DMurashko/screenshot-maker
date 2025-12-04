import { useEffect, useRef, useState, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Rect, Circle, Arrow, Text, Transformer } from "react-konva";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import "./Editor.css";

type Tool = "select" | "pen" | "highlighter" | "arrow" | "rect" | "circle" | "text" | "crop";

interface Shape {
  id: string;
  tool: Tool;
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  color: string;
  strokeWidth: number;
}

interface EditorProps {
  onClose?: () => void;
}

export function Editor({ onClose }: EditorProps) {
  const [screenshot, setScreenshot] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#ff0000");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);

  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load screenshot
  useEffect(() => {
    invoke<string | null>("get_current_screenshot").then((data) => {
      if (data) {
        loadImage(data);
      }
    });

    const unlisten = listen<string>("screenshot-taken", (event) => {
      loadImage(event.payload);
      setShapes([]); // Clear previous shapes
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const loadImage = (dataUrl: string) => {
    const img = document.createElement("img") as HTMLImageElement;
    img.onload = () => {
      setScreenshot(img);
      // Calculate stage size to fit the container
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth - 40;
        const containerHeight = containerRef.current.clientHeight - 40;
        const scale = Math.min(
          containerWidth / img.width,
          containerHeight / img.height,
          1
        );
        setStageSize({
          width: img.width * scale,
          height: img.height * scale,
        });
      }
    };
    img.src = dataUrl;
  };

  // Update transformer when selection changes
  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId]);

  // Copy to clipboard whenever shapes change
  const copyToClipboard = useCallback(async () => {
    if (!stageRef.current) return;

    // Hide transformer for export
    if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }

    // Small delay to ensure transformer is hidden
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
      // Extract base64 data without the prefix
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

      // Convert base64 to Uint8Array
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      await writeImage(bytes);
      console.log("Copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  }, []);

  // Auto-copy when shapes change (debounced)
  useEffect(() => {
    if (shapes.length > 0 && !isDrawing) {
      const timer = setTimeout(() => {
        copyToClipboard();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [shapes, isDrawing, copyToClipboard]);

  const handleMouseDown = (e: any) => {
    if (tool === "select") {
      const clickedOnEmpty = e.target === e.target.getStage() || e.target.className === "Image";
      if (clickedOnEmpty) {
        setSelectedId(null);
      }
      return;
    }

    if (tool === "text") {
      const pos = e.target.getStage().getPointerPosition();
      setTextPosition(pos);
      return;
    }

    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const id = `shape-${Date.now()}`;

    if (tool === "pen" || tool === "highlighter") {
      setShapes([
        ...shapes,
        {
          id,
          tool,
          points: [pos.x, pos.y],
          color: tool === "highlighter" ? `${color}80` : color,
          strokeWidth: tool === "highlighter" ? strokeWidth * 4 : strokeWidth,
        },
      ]);
    } else if (tool === "arrow") {
      setShapes([
        ...shapes,
        {
          id,
          tool,
          points: [pos.x, pos.y, pos.x, pos.y],
          color,
          strokeWidth,
        },
      ]);
    } else if (tool === "rect" || tool === "circle") {
      setShapes([
        ...shapes,
        {
          id,
          tool,
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          radius: 0,
          color,
          strokeWidth,
        },
      ]);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;

    const pos = e.target.getStage().getPointerPosition();
    const lastShape = shapes[shapes.length - 1];

    if (!lastShape) return;

    if (tool === "pen" || tool === "highlighter") {
      const newPoints = [...(lastShape.points || []), pos.x, pos.y];
      setShapes([
        ...shapes.slice(0, -1),
        { ...lastShape, points: newPoints },
      ]);
    } else if (tool === "arrow") {
      const points = lastShape.points || [0, 0, 0, 0];
      setShapes([
        ...shapes.slice(0, -1),
        { ...lastShape, points: [points[0], points[1], pos.x, pos.y] },
      ]);
    } else if (tool === "rect") {
      setShapes([
        ...shapes.slice(0, -1),
        {
          ...lastShape,
          width: pos.x - (lastShape.x || 0),
          height: pos.y - (lastShape.y || 0),
        },
      ]);
    } else if (tool === "circle") {
      const dx = pos.x - (lastShape.x || 0);
      const dy = pos.y - (lastShape.y || 0);
      setShapes([
        ...shapes.slice(0, -1),
        { ...lastShape, radius: Math.sqrt(dx * dx + dy * dy) },
      ]);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const addText = () => {
    if (!textInput || !textPosition) return;

    const id = `shape-${Date.now()}`;
    setShapes([
      ...shapes,
      {
        id,
        tool: "text",
        x: textPosition.x,
        y: textPosition.y,
        text: textInput,
        color,
        strokeWidth,
      },
    ]);
    setTextInput("");
    setTextPosition(null);
  };

  const undo = () => {
    setShapes(shapes.slice(0, -1));
    setSelectedId(null);
  };

  const clearAll = () => {
    setShapes([]);
    setSelectedId(null);
  };

  const deleteSelected = () => {
    if (selectedId) {
      setShapes(shapes.filter((s) => s.id !== selectedId));
      setSelectedId(null);
    }
  };

  const tools: { id: Tool; icon: string; label: string }[] = [
    { id: "select", icon: "↖", label: "Select" },
    { id: "pen", icon: "✏️", label: "Pen" },
    { id: "highlighter", icon: "🖍️", label: "Highlight" },
    { id: "arrow", icon: "→", label: "Arrow" },
    { id: "rect", icon: "□", label: "Rectangle" },
    { id: "circle", icon: "○", label: "Circle" },
    { id: "text", icon: "T", label: "Text" },
  ];

  const colors = ["#ff0000", "#00ff00", "#0066ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#000000"];

  return (
    <div className="editor-container">
      <div className="editor-toolbar">
        <div className="toolbar-section">
          <span className="toolbar-label">Tools</span>
          <div className="tool-buttons">
            {tools.map((t) => (
              <button
                key={t.id}
                className={`tool-btn ${tool === t.id ? "active" : ""}`}
                onClick={() => setTool(t.id)}
                title={t.label}
              >
                {t.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-section">
          <span className="toolbar-label">Color</span>
          <div className="color-buttons">
            {colors.map((c) => (
              <button
                key={c}
                className={`color-btn ${color === c ? "active" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="toolbar-section">
          <span className="toolbar-label">Size</span>
          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="size-slider"
          />
        </div>

        <div className="toolbar-section">
          <span className="toolbar-label">Actions</span>
          <div className="action-buttons">
            <button className="action-btn" onClick={undo} title="Undo">
              ↩
            </button>
            <button className="action-btn" onClick={clearAll} title="Clear All">
              🗑️
            </button>
            <button className="action-btn" onClick={deleteSelected} title="Delete Selected" disabled={!selectedId}>
              ✕
            </button>
            <button className="action-btn primary" onClick={copyToClipboard} title="Copy to Clipboard">
              📋 Copy
            </button>
          </div>
        </div>

        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="editor-canvas" ref={containerRef}>
        {screenshot && (
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ cursor: tool === "select" ? "default" : "crosshair" }}
          >
            <Layer>
              <KonvaImage
                image={screenshot}
                width={stageSize.width}
                height={stageSize.height}
              />
              {shapes.map((shape) => {
                if (shape.tool === "pen" || shape.tool === "highlighter") {
                  return (
                    <Line
                      key={shape.id}
                      id={shape.id}
                      points={shape.points}
                      stroke={shape.color}
                      strokeWidth={shape.strokeWidth}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation={
                        shape.tool === "highlighter" ? "multiply" : "source-over"
                      }
                      draggable={tool === "select"}
                      onClick={() => tool === "select" && setSelectedId(shape.id)}
                    />
                  );
                }
                if (shape.tool === "arrow") {
                  return (
                    <Arrow
                      key={shape.id}
                      id={shape.id}
                      points={shape.points || []}
                      stroke={shape.color}
                      strokeWidth={shape.strokeWidth}
                      fill={shape.color}
                      draggable={tool === "select"}
                      onClick={() => tool === "select" && setSelectedId(shape.id)}
                    />
                  );
                }
                if (shape.tool === "rect") {
                  return (
                    <Rect
                      key={shape.id}
                      id={shape.id}
                      x={shape.x}
                      y={shape.y}
                      width={shape.width}
                      height={shape.height}
                      stroke={shape.color}
                      strokeWidth={shape.strokeWidth}
                      draggable={tool === "select"}
                      onClick={() => tool === "select" && setSelectedId(shape.id)}
                    />
                  );
                }
                if (shape.tool === "circle") {
                  return (
                    <Circle
                      key={shape.id}
                      id={shape.id}
                      x={shape.x}
                      y={shape.y}
                      radius={shape.radius}
                      stroke={shape.color}
                      strokeWidth={shape.strokeWidth}
                      draggable={tool === "select"}
                      onClick={() => tool === "select" && setSelectedId(shape.id)}
                    />
                  );
                }
                if (shape.tool === "text") {
                  return (
                    <Text
                      key={shape.id}
                      id={shape.id}
                      x={shape.x}
                      y={shape.y}
                      text={shape.text}
                      fontSize={shape.strokeWidth * 6}
                      fill={shape.color}
                      draggable={tool === "select"}
                      onClick={() => tool === "select" && setSelectedId(shape.id)}
                    />
                  );
                }
                return null;
              })}
              <Transformer ref={transformerRef} />
            </Layer>
          </Stage>
        )}

        {!screenshot && (
          <div className="no-screenshot">
            <p>No screenshot available</p>
            <p className="hint">Press <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>S</kbd> to take a screenshot</p>
          </div>
        )}
      </div>

      {textPosition && (
        <div
          className="text-input-overlay"
          style={{ left: textPosition.x, top: textPosition.y + 80 }}
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addText()}
            placeholder="Type text..."
            autoFocus
          />
          <button onClick={addText}>Add</button>
          <button onClick={() => setTextPosition(null)}>Cancel</button>
        </div>
      )}

      <div className="editor-status">
        <span className="clipboard-status">✓ Auto-copying to clipboard</span>
      </div>
    </div>
  );
}

