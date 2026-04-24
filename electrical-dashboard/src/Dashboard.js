import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useComponents from "./hooks/useComponents";
import * as XLSX from "xlsx";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const STATUS_COLORS = {
  "To Do": "#e74c3c",
  "Doing": "#f39c12",
  "Done": "#27ae60"
};

const STATUS_CYCLE = ["To Do", "Doing", "Done"];

// Modern button component
const Button = ({ children, variant = "primary", size = "medium", onClick, disabled = false, style = {} }) => {
  const baseStyle = {
    padding: size === "small" ? "8px 16px" : size === "large" ? "16px 32px" : "12px 24px",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: size === "small" ? "14px" : "16px",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    textDecoration: "none",
    ...style
  };

  const variants = {
    primary: {
      background: disabled ? "#bdc3c7" : "#3498db",
      color: "white",
      boxShadow: disabled ? "none" : "0 2px 4px rgba(52, 152, 219, 0.3)",
      "&:hover": {
        background: disabled ? "#bdc3c7" : "#2980b9",
        transform: disabled ? "none" : "translateY(-1px)",
        boxShadow: disabled ? "none" : "0 4px 8px rgba(52, 152, 219, 0.4)"
      }
    },
    secondary: {
      background: disabled ? "#ecf0f1" : "#ecf0f1",
      color: disabled ? "#bdc3c7" : "#2c3e50",
      border: `2px solid ${disabled ? "#bdc3c7" : "#bdc3c7"}`,
      "&:hover": {
        background: disabled ? "#ecf0f1" : "#d5dbdb",
        borderColor: disabled ? "#bdc3c7" : "#95a5a6"
      }
    },
    danger: {
      background: disabled ? "#ecf0f1" : "#e74c3c",
      color: disabled ? "#bdc3c7" : "white",
      "&:hover": {
        background: disabled ? "#ecf0f1" : "#c0392b"
      }
    },
    success: {
      background: disabled ? "#ecf0f1" : "#27ae60",
      color: disabled ? "#bdc3c7" : "white",
      "&:hover": {
        background: disabled ? "#ecf0f1" : "#229954"
      }
    }
  };

  const buttonStyle = {
    ...baseStyle,
    ...variants[variant],
    opacity: disabled ? 0.6 : 1
  };

  return (
    <button
      style={buttonStyle}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled && variants[variant]["&:hover"]) {
          Object.assign(e.target.style, variants[variant]["&:hover"]);
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          Object.assign(e.target.style, buttonStyle);
        }
      }}
    >
      {children}
    </button>
  );
};

// Status badge component
const StatusBadge = ({ status }) => {
  const badgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    background: STATUS_COLORS[status],
    color: "white",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
  };

  return <span style={badgeStyle}>{status}</span>;
};

// Card component
const Card = ({ children, style = {} }) => {
  const cardStyle = {
    background: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.1)",
    padding: "24px",
    border: "1px solid #f1f3f4",
    ...style
  };

  return <div style={cardStyle}>{children}</div>;
};

// Helper to get local formatted date-time string
function getLocalDateTime() {
  const now = new Date();
  return now.toLocaleString(undefined, { hour12: false });
}

export default function Dashboard() {
  console.log("Dashboard component rendered");
  const query = useQuery();
  const image = query.get("image") || "page_1.png";
  const [components, setComponents, saveComponents, projectTitle, setProjectTitle] = useComponents(image);
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [modal, setModal] = useState({ open: false, rect: null, idx: null });
  const [form, setForm] = useState({ name: "", responsible_person: "" });
  const [drawing, setDrawing] = useState(false);
  const [rect, setRect] = useState(null);
  // Persist zoom level in localStorage
  const getInitialZoom = () => {
    const z = localStorage.getItem("dashboardZoom");
    return z ? parseFloat(z) : 1;
  };
  const [zoom, setZoom] = useState(getInitialZoom());
  useEffect(() => {
    localStorage.setItem("dashboardZoom", zoom);
  }, [zoom]);
  const [fitZoom, setFitZoom] = useState(1);
  const imgRef = useRef();
  const [imgSize, setImgSize] = useState({ width: 1, height: 1 });
  const containerRef = useRef();
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });
  // Toast state
  // Unified feedback modal (for Excel and clear all)
  const [excelModal, setExcelModal] = useState({ open: false, message: "" });
  // Modal for clear all
  const [clearModal, setClearModal] = useState(false);

  // Add draw mode state
  const SHAPE_MODES = [
    { key: 'rectangle', icon: '▭', label: 'Rectangle' },
    { key: 'circle', icon: '◯', label: 'Circle' },
    { key: 'line', icon: '／', label: 'Line' }
  ];
  const [drawMode, setDrawMode] = useState('rectangle');
  const [linePoints, setLinePoints] = useState([]); // For line drawing
  const [drawingInstruction, setDrawingInstruction] = useState("");

  // Get unique Name/Type and Responsible Person values for dropdowns
  const nameOptions = Array.from(new Set(
    components
      .map(c => c.name)
      .filter(name => name && name.trim() !== '')
  )).sort();
  
  const personOptions = Array.from(new Set(
    components
      .map(c => c.responsible_person)
      .filter(person => person && person.trim() !== '')
  )).sort();

  // Fit image to container on load/resize
  useEffect(() => {
    function handleResize() {
      if (!imgRef.current || !containerRef.current) return;
      const containerW = containerRef.current.offsetWidth;
      const containerH = containerRef.current.offsetHeight;
      setContainerSize({ width: containerW, height: containerH });
      if (imgSize.width && imgSize.height) {
        const zoomW = containerW / imgSize.width;
        const zoomH = containerH / imgSize.height;
        const fit = Math.min(zoomW, zoomH, 1);
        setFitZoom(fit);
        setZoom(fit);
      }
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [imgSize.width, imgSize.height]);

  // On image load, fit to container
  const handleImgLoad = (e) => {
    const width = e.target.naturalWidth;
    const height = e.target.naturalHeight;
    setImgSize({ width, height });
    if (containerRef.current) {
      const containerW = containerRef.current.offsetWidth;
      const containerH = containerRef.current.offsetHeight;
      setContainerSize({ width: containerW, height: containerH });
      const zoomW = containerW / width;
      const zoomH = containerH / height;
      const fit = Math.min(zoomW, zoomH, 1);
      setFitZoom(fit);
      setZoom(fit);
    }
  };

  // Handle status change on click
  const handleStatusChange = async (idx) => {
    setComponents((prev) => {
      const updated = [...prev];
      const comp = { ...updated[idx] };
      const currentIdx = STATUS_CYCLE.indexOf(comp.status);
      comp.status = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
      comp.date_modified = new Date().toISOString();
      updated[idx] = comp;
      return updated;
    });
    // Save after state update
    await saveComponents(
      components.map((c, i) =>
        i === idx
          ? { ...c, status: STATUS_CYCLE[(STATUS_CYCLE.indexOf(c.status) + 1) % STATUS_CYCLE.length], date_modified: new Date().toISOString() }
          : c
      )
    );
  };

  // Rectangle selection logic
  // --- FIXED: Accurate image coordinates with scroll/zoom ---
  const getImageCoords = (clientX, clientY) => {
    if (!imgRef.current || !containerRef.current) return { x: 0, y: 0 };
    const imgRect = imgRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    // Mouse position relative to the container (scroll area)
    const mouseX = clientX - containerRect.left + containerRef.current.scrollLeft;
    const mouseY = clientY - containerRect.top + containerRef.current.scrollTop;
    // Now, relative to the image's top-left in the scroll area
    // The image is always at (0,0) in the scroll area, but may be scaled by zoom
    const x = mouseX / (imgSize.width * zoom) * imgSize.width;
    const y = mouseY / (imgSize.height * zoom) * imgSize.height;
    // Clamp to image bounds
    return {
      x: Math.max(0, Math.min(imgSize.width, x)),
      y: Math.max(0, Math.min(imgSize.height, y))
    };
  };

  // --- Drawing logic update ---
  const handleMouseDown = (e) => {
    if (relocateMode.active) {
      // Only allow dragging the selected shape
      if (e.target.dataset.rectidx !== undefined && Number(e.target.dataset.rectidx) === relocateMode.idx) {
        setDraggingRelocate(true);
        const comp = components[relocateMode.idx];
        let start = { x: 0, y: 0 };
        if (comp.shape === 'rectangle' && comp.rect) {
          start = { x: e.clientX, y: e.clientY, orig: { ...comp.rect } };
        } else if (comp.shape === 'circle' && comp.circle) {
          start = { x: e.clientX, y: e.clientY, orig: { ...comp.circle } };
        } else if (comp.shape === 'line' && comp.line && comp.line.points) {
          start = { x: e.clientX, y: e.clientY, orig: comp.line.points.map(pt => ({ ...pt })) };
        }
        setRelocateDragStart(start);
      }
      return;
    }
    if (!editMode) return;
    if (e.target.dataset.rectidx !== undefined) return;
    const { x, y } = getImageCoords(e.clientX, e.clientY);
    if (drawMode === 'rectangle') {
      setDrawing(true);
      setRect({ x1: x, y1: y, x2: x, y2: y });
      setDrawingInstruction('Drag to draw rectangle');
    } else if (drawMode === 'circle') {
      setDrawing(true);
      setRect({ cx: x, cy: y, r: 0 });
      setDrawingInstruction('Drag outward to set radius');
    } else if (drawMode === 'line') {
      if (!drawing) {
        setDrawing(true);
        setLinePoints([{ x, y }]);
        setDrawingInstruction('Click to add points, double-click to finish');
      } else {
        setLinePoints((prev) => [...prev, { x, y }]);
      }
    }
  };
  const handleMouseMove = (e) => {
    if (relocateMode.active && draggingRelocate && relocateDragStart) {
      const comp = components[relocateMode.idx];
      const dx = (e.clientX - relocateDragStart.x) / zoom;
      const dy = (e.clientY - relocateDragStart.y) / zoom;
      let updated = [...components];
      if (comp.shape === 'rectangle' && comp.rect) {
        updated[relocateMode.idx] = {
          ...comp,
          rect: {
            x1: relocateDragStart.orig.x1 + dx,
            y1: relocateDragStart.orig.y1 + dy,
            x2: relocateDragStart.orig.x2 + dx,
            y2: relocateDragStart.orig.y2 + dy
          }
        };
      } else if (comp.shape === 'circle' && comp.circle) {
        updated[relocateMode.idx] = {
          ...comp,
          circle: {
            cx: relocateDragStart.orig.cx + dx,
            cy: relocateDragStart.orig.cy + dy,
            r: relocateDragStart.orig.r
          }
        };
      } else if (comp.shape === 'line' && comp.line && comp.line.points) {
        // Move all points by the drag delta
        const newPoints = relocateDragStart.orig.map(pt => ({ x: pt.x + dx, y: pt.y + dy }));
        updated[relocateMode.idx] = {
          ...comp,
          line: {
            points: newPoints
          }
        };
      }
      setComponents(updated);
      return;
    }
    if (!editMode || !drawing) return;
    const { x, y } = getImageCoords(e.clientX, e.clientY);
    if (drawMode === 'rectangle' && rect) {
      setRect((prev) => prev ? { ...prev, x2: x, y2: y } : null);
    } else if (drawMode === 'circle' && rect) {
      const dx = x - rect.cx;
      const dy = y - rect.cy;
      setRect((prev) => prev ? { ...prev, r: Math.sqrt(dx * dx + dy * dy) } : null);
    } else if (drawMode === 'line' && linePoints.length > 0) {
      setLinePoints((prev) => {
        const pts = [...prev];
        pts[pts.length - 1] = { x, y };
        return pts;
      });
    }
  };
  const handleMouseUp = (e) => {
    if (relocateMode.active && draggingRelocate) {
      setDraggingRelocate(false);
      setRelocateDragStart(null);
      // Reopen modal for this component
      setTimeout(() => {
        setModal({ open: true, rect: null, idx: relocateMode.idx });
        setRelocateMode({ active: false, idx: null, original: null });
        setJustRelocated(true);
      }, 100);
      return;
    }
    if (!editMode || !drawing) return;
    if (drawMode === 'rectangle') {
      setDrawing(false);
      setModal({ open: true, rect, idx: null });
      setForm({ name: "", responsible_person: "" });
      setRect(null);
      setDrawingInstruction("");
    } else if (drawMode === 'circle') {
      setDrawing(false);
      setModal({ open: true, rect, idx: null });
      setForm({ name: "", responsible_person: "" });
      setRect(null);
      setDrawingInstruction("");
    } else if (drawMode === 'line') {
      // For line, mouse up does not finish, double-click does
    }
  };
  const handleDoubleClick = (e) => {
    if (!editMode || !drawing || drawMode !== 'line') return;
    setDrawing(false);
    setModal({ open: true, rect: { points: linePoints }, idx: null });
    setForm({ name: "", responsible_person: "" });
    setLinePoints([]);
    setDrawingInstruction("");
  };

  // Handle form submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    let updated;
    if (modal.idx !== null) {
      updated = components.map((c, i) =>
        i === modal.idx
          ? {
              ...c,
              name: form.name,
              responsible_person: form.responsible_person,
              date_modified: getLocalDateTime(),
              shape: c.shape || drawMode // preserve or fallback
            }
          : c
      );
    } else {
      let shapeData = {};
      if (drawMode === 'rectangle') shapeData = { rect: modal.rect };
      if (drawMode === 'circle') shapeData = { circle: modal.rect };
      if (drawMode === 'line') {
        // Filter out null/invalid points and require at least 2
        const points = (modal.rect?.points || []).filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
        if (points.length < 2) {
          setModal({ open: false, rect: null, idx: null });
          setExcelModal({ open: true, message: '⚠️ A line must have at least two points.' });
          return;
        }
        shapeData = { line: { points } };
      }
      updated = [
        ...components,
        {
          name: form.name,
          status: "To Do",
          date_modified: getLocalDateTime(),
          responsible_person: form.responsible_person,
          shape: drawMode,
          ...shapeData
        }
      ];
    }
    setComponents(updated);
    await saveComponents(updated);
    setModal({ open: false, rect: null, idx: null });
    setRelocateOriginalShape(null);
    setJustRelocated(false);
  };

  // Delete component
  const handleDelete = async (e) => {
    e.preventDefault();
    if (modal.idx === null) return;
    const updated = components.filter((_, i) => i !== modal.idx);
    setComponents(updated);
    await saveComponents(updated);
    setModal({ open: false, rect: null, idx: null });
    setRelocateOriginalShape(null);
    setJustRelocated(false);
  };

  // Cancel in modal: restore original shape if just relocated
  const handleCancelModal = (e) => {
    e.stopPropagation();
    setModal({ open: false, rect: null, idx: null });
    if (justRelocated && relocateOriginalShape && typeof modal.idx === 'number') {
      setComponents((prev) => prev.map((c, i) => i === modal.idx ? relocateOriginalShape : c));
    }
    setRelocateOriginalShape(null);
    setJustRelocated(false);
  };

  // Zoom controls
  const handleZoom = (factor) => {
    setZoom((z) => Math.max(fitZoom * 0.2, Math.min(fitZoom * 3, z * factor)));
  };

  // Group summary by Name/Type and status
  // 3. Defensive summary logic: Only count valid components (with shape and geometry)
  const summaryByType = {};
  components.forEach((c) => {
    // Only count if shape and geometry are valid
    if (!c.name || !c.shape) return;
    if (c.shape === 'rectangle' && !c.rect) return;
    if (c.shape === 'circle' && !c.circle) return;
    if (c.shape === 'line' && (!c.line || !Array.isArray(c.line.points) || c.line.points.length < 2)) return;
    if (!summaryByType[c.name]) summaryByType[c.name] = { count: 0, todo: 0, doing: 0, done: 0 };
    summaryByType[c.name].count++;
    if (c.status === "To Do") summaryByType[c.name].todo++;
    if (c.status === "Doing") summaryByType[c.name].doing++;
    if (c.status === "Done") summaryByType[c.name].done++;
  });

  // Edit existing rectangle in edit mode
  const handleRectClick = (idx) => {
    if (!editMode) return;
    const comp = components[idx];
    setModal({ open: true, rect: comp.rect, idx });
    setForm({ name: comp.name, responsible_person: comp.responsible_person });
  };

  // Handle Ctrl+scroll for zoom
  const handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) handleZoom(1.1);
      else handleZoom(1 / 1.1);
    }
  };

  // Enhanced Progress Bar
  function ProgressBar({ value, showPercentage = true }) {
    return (
      <div style={{ 
        width: "100%", 
        background: "#f8f9fa", 
        borderRadius: "10px", 
        height: "20px", 
        position: "relative",
        overflow: "hidden",
        border: "1px solid #e9ecef"
      }}>
        <div
          style={{
            width: `${value}%`,
            background: value === 100 ? 
              'linear-gradient(90deg, #27ae60, #2ecc71)' : 
              value > 0 ? 
                'linear-gradient(90deg, #f39c12, #f1c40f)' : 
                'linear-gradient(90deg, #e74c3c, #c0392b)',
            height: "20px",
            borderRadius: "10px",
            transition: 'width 0.5s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '600',
            fontSize: '12px',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            position: 'relative'
          }}
        >
          {showPercentage && value > 0 && (
            <span style={{ 
              position: 'absolute',
              right: '8px',
              color: 'white',
              fontWeight: '600',
              fontSize: '11px'
            }}>
              {value}%
            </span>
          )}
        </div>
      </div>
    );
  }

  // Stats cards
  const totalComponents = components.length;
  const completedComponents = components.filter(c => c.status === "Done").length;
  const inProgressComponents = components.filter(c => c.status === "Doing").length;
  const todoComponents = components.filter(c => c.status === "To Do").length;

  // Use useCallback for hover handlers
  const handleMouseEnter = useCallback((idx) => setHovered(idx), []);
  const handleMouseLeave = useCallback(() => setHovered(null), []);

  // Sorting state for summary table
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const handleSort = (key, isNumeric = false) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc", isNumeric };
      } else {
        return { key, direction: "asc", isNumeric };
      }
    });
  };

  // Relocation mode state
  const [relocateMode, setRelocateMode] = useState({ active: false, idx: null, original: null });
  // State for relocation drag
  const [draggingRelocate, setDraggingRelocate] = useState(false);
  const [relocateDragStart, setRelocateDragStart] = useState(null);
  // Store original shape for cancel
  const [relocateOriginalShape, setRelocateOriginalShape] = useState(null);
  // Track if modal is reopening after relocate
  const [justRelocated, setJustRelocated] = useState(false);

  // Prepare summary rows for sorting
  const summaryRows = Object.entries(summaryByType).map(([name, { count, todo, doing, done }]) => ({
    name,
    count,
    todo,
    doing,
    done,
    percent: count > 0 ? Math.round((done / count) * 100) : 0
  }));
  // Sort rows
  summaryRows.sort((a, b) => {
    const { key, direction } = sortConfig;
    let v1 = a[key], v2 = b[key];
    // Numeric sort if key is numeric
    if (["count", "todo", "doing", "done", "percent"].includes(key)) {
      v1 = Number(v1);
      v2 = Number(v2);
      if (v1 === v2) return 0;
      return direction === "asc" ? v1 - v2 : v2 - v1;
    } else {
      // Alphabetical
      v1 = v1?.toString().toLowerCase() || "";
      v2 = v2?.toString().toLowerCase() || "";
      if (v1 === v2) return 0;
      return direction === "asc" ? (v1 < v2 ? -1 : 1) : (v1 > v2 ? -1 : 1);
    }
  });

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px"
    }}>
      <button
        style={{
          marginBottom: 24,
          background: "#fff",
          color: "#764ba2",
          border: "1px solid #764ba2",
          borderRadius: 8,
          padding: "8px 20px",
          fontWeight: 700,
          fontSize: 16,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}
        onClick={() => navigate(-1)}
      >
        ← Return
      </button>
      {/* Header */}
      <div style={{
        textAlign: "center",
        marginBottom: "32px",
        color: "white"
      }}>
        <h1 style={{
          fontSize: "2.5rem",
          fontWeight: "700",
          margin: "0 0 8px 0",
          textShadow: "0 2px 4px rgba(0,0,0,0.3)"
        }}>
          Electrical Layout Dashboard
        </h1>
        <p style={{
          fontSize: "1.1rem",
          opacity: 0.9,
          margin: 0,
          fontWeight: "300"
        }}>
          Manage and track electrical components with real-time status updates
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "20px",
        marginBottom: "32px",
        maxWidth: "1200px",
        margin: "0 auto 32px auto"
      }}>
        <Card style={{ textAlign: "center", background: "rgba(255,255,255,0.95)" }}>
          <div style={{ fontSize: "2rem", fontWeight: "700", color: "#2c3e50", marginBottom: "8px" }}>
            {totalComponents}
          </div>
          <div style={{ color: "#7f8c8d", fontSize: "0.9rem" }}>Total Components</div>
        </Card>
        <Card style={{ textAlign: "center", background: "rgba(255,255,255,0.95)" }}>
          <div style={{ fontSize: "2rem", fontWeight: "700", color: "#27ae60", marginBottom: "8px" }}>
            {completedComponents}
          </div>
          <div style={{ color: "#7f8c8d", fontSize: "0.9rem" }}>Completed</div>
        </Card>
        <Card style={{ textAlign: "center", background: "rgba(255,255,255,0.95)" }}>
          <div style={{ fontSize: "2rem", fontWeight: "700", color: "#f39c12", marginBottom: "8px" }}>
            {inProgressComponents}
          </div>
          <div style={{ color: "#7f8c8d", fontSize: "0.9rem" }}>In Progress</div>
        </Card>
        <Card style={{ textAlign: "center", background: "rgba(255,255,255,0.95)" }}>
          <div style={{ fontSize: "2rem", fontWeight: "700", color: "#e74c3c", marginBottom: "8px" }}>
            {todoComponents}
          </div>
          <div style={{ color: "#7f8c8d", fontSize: "0.9rem" }}>To Do</div>
        </Card>
      </div>

      {/* Control Panel */}
      {/* Move toolbar to the right of the image/map, vertical alignment */}
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto 24px auto",
        display: "flex",
        flexDirection: "row",
        gap: "24px",
        alignItems: "flex-start",
        justifyContent: "center"
      }}>
        {/* Image Container with blueprint/technical drawing style */}
        <Card style={{
          flex: 1,
          padding: 0,
          background: "#f4f7fa",
          border: "4px solid #b0bec5",
          boxShadow: "0 8px 32px rgba(44, 62, 80, 0.18), 0 1.5px 6px rgba(44, 62, 80, 0.10)",
          borderRadius: "18px",
          overflow: "hidden",
          minWidth: 0,
          minHeight: "500px",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center"
        }}>
          {/* --- FIX: Make scroll area always fit image, allow full scroll at any zoom --- */}
          <div
            ref={containerRef}
            style={{
              position: "relative",
              background: "#e3eaf2",
              overflow: "auto",
              width: "100%",
              minHeight: "500px",
              height: "70vh",
              maxHeight: "80vh",
              borderRadius: "12px",
              border: "2px solid #90a4ae",
              boxShadow: "0 2px 12px rgba(44, 62, 80, 0.10)",
              aspectRatio: imgSize.width && imgSize.height ? `${imgSize.width} / ${imgSize.height}` : undefined,
              display: "flex", // changed from block to flex
              alignItems: "stretch", // ensure tight fit
              justifyContent: "stretch", // ensure tight fit
              padding: 0, // remove any padding
              margin: 0 // remove any margin
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onWheel={(e) => {
              // Only zoom if Ctrl is pressed and event is inside the viewer
              if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                if (e.deltaY < 0) handleZoom(1.1);
                else handleZoom(1 / 1.1);
              }
            }}
          >
            {/* The image and overlays are in a div sized to the zoomed image, so scrollbars always match image size */}
            <div style={{
              position: "relative",
              width: imgSize.width * zoom,
              height: imgSize.height * zoom,
              minWidth: imgSize.width * zoom,
              minHeight: imgSize.height * zoom,
              display: "block",
              margin: 0, // remove any margin
              padding: 0 // remove any padding
            }}>
              <img
                ref={imgRef}
                src={image.startsWith('/') || image.startsWith('http') ? image : '/images/' + image}
                alt="Electrical Layout"
                style={{
                  width: imgSize.width * zoom,
                  height: imgSize.height * zoom,
                  display: "block",
                  cursor: editMode ? "crosshair" : "default",
                  background: "#fff",
                  borderRadius: "8px",
                  boxShadow: "0 8px 32px rgba(44, 62, 80, 0.18), 0 1.5px 6px rgba(44, 62, 80, 0.10)",
                  border: "2px solid #78909c",
                  margin: 0, // remove any margin
                  padding: 0 // remove any padding
                }}
                onMouseDown={handleMouseDown}
                onLoad={handleImgLoad}
                draggable={false}
              />
              {/* Overlay shapes */}
              <div style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: imgSize.width * zoom,
                height: imgSize.height * zoom,
                pointerEvents: "none"
              }}>
                {components.map((comp, idx) => {
                  if (relocateMode.active && idx !== relocateMode.idx) return null; // Only show the selected shape
                  if (comp.shape === 'rectangle' && comp.rect) {
                    const { x1, y1, x2, y2 } = comp.rect;
                    const left = Math.min(x1, x2) * zoom;
                    const top = Math.min(y1, y2) * zoom;
                    const width = Math.abs(x2 - x1) * zoom;
                    const height = Math.abs(y2 - y1) * zoom;
                    return (
                      <div
                        key={comp.name + idx}
                        data-rectidx={idx}
                        style={{
                          position: "absolute",
                          left,
                          top,
                          width,
                          height,
                          border: relocateMode.active ? `4px solid #ffd700` : `3px solid ${STATUS_COLORS[comp.status]}`,
                          background: relocateMode.active ? `#ffd70022` : (hovered === idx ? `${STATUS_COLORS[comp.status]}20` : `${STATUS_COLORS[comp.status]}10`),
                          zIndex: 2,
                          cursor: relocateMode.active ? "grab" : (editMode ? "pointer" : "pointer"),
                          boxSizing: "border-box",
                          pointerEvents: relocateMode.active ? "auto" : "auto",
                          borderRadius: "4px",
                          transition: "all 0.2s ease",
                          boxShadow: relocateMode.active ? `0 0 0 4px #ffd70066` : (hovered === idx ? `0 0 0 2px ${STATUS_COLORS[comp.status]}40` : "0 2px 4px rgba(0,0,0,0.1)")
                        }}
                        onMouseDown={relocateMode.active ? handleMouseDown : (editMode ? () => handleRectClick(idx) : () => handleStatusChange(idx))}
                        onMouseEnter={() => handleMouseEnter(idx)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {/* Enhanced Tooltip */}
                        {!relocateMode.active && hovered === idx && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: "100%",
                              marginLeft: "12px",
                              background: "white",
                              border: "1px solid #e9ecef",
                              borderRadius: "8px",
                              padding: "16px",
                              minWidth: "220px",
                              zIndex: 10,
                              boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                              fontSize: "14px"
                            }}
                          >
                            <div style={{ marginBottom: "8px" }}>
                              <strong style={{ color: "#2c3e50", fontSize: "16px" }}>{comp.name}</strong>
                            </div>
                            <div style={{ marginBottom: "6px" }}>
                              <StatusBadge status={comp.status} />
                            </div>
                            <div style={{ color: "#7f8c8d", fontSize: "12px", marginBottom: "4px" }}>
                              <strong>Last Modified:</strong> {new Date(comp.date_modified).toLocaleString()}
                            </div>
                            {comp.responsible_person && (
                              <div style={{ color: "#7f8c8d", fontSize: "12px" }}>
                                <strong>Responsible:</strong> {comp.responsible_person}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  } else if (comp.shape === 'circle' && comp.circle) {
                    // Draw circle overlay
                    const { cx, cy, r } = comp.circle;
                    return (
                      <div
                        key={comp.name + idx}
                        data-rectidx={idx}
                        style={{
                          position: "absolute",
                          left: (cx - r) * zoom,
                          top: (cy - r) * zoom,
                          width: r * 2 * zoom,
                          height: r * 2 * zoom,
                          border: relocateMode.active ? `4px solid #ffd700` : `3px solid ${STATUS_COLORS[comp.status]}`,
                          borderRadius: "50%",
                          background: relocateMode.active ? `#ffd70022` : (hovered === idx ? `${STATUS_COLORS[comp.status]}20` : `${STATUS_COLORS[comp.status]}10`),
                          zIndex: 2,
                          cursor: relocateMode.active ? "grab" : (editMode ? "pointer" : "pointer"),
                          boxSizing: "border-box",
                          pointerEvents: relocateMode.active ? "auto" : "auto",
                          transition: "all 0.2s ease",
                          boxShadow: relocateMode.active ? `0 0 0 4px #ffd70066` : (hovered === idx ? `0 0 0 2px ${STATUS_COLORS[comp.status]}40` : "0 2px 4px rgba(0,0,0,0.1)")
                        }}
                        onMouseDown={relocateMode.active ? handleMouseDown : (editMode ? () => handleRectClick(idx) : () => handleStatusChange(idx))}
                        onMouseEnter={() => handleMouseEnter(idx)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {/* Enhanced Tooltip */}
                        {!relocateMode.active && hovered === idx && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: "100%",
                              marginLeft: "12px",
                              background: "white",
                              border: "1px solid #e9ecef",
                              borderRadius: "8px",
                              padding: "16px",
                              minWidth: "220px",
                              zIndex: 10,
                              boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                              fontSize: "14px"
                            }}
                          >
                            <div style={{ marginBottom: "8px" }}>
                              <strong style={{ color: "#2c3e50", fontSize: "16px" }}>{comp.name}</strong>
                            </div>
                            <div style={{ marginBottom: "6px" }}>
                              <StatusBadge status={comp.status} />
                            </div>
                            <div style={{ color: "#7f8c8d", fontSize: "12px", marginBottom: "4px" }}>
                              <strong>Last Modified:</strong> {new Date(comp.date_modified).toLocaleString()}
                            </div>
                            {comp.responsible_person && (
                              <div style={{ color: "#7f8c8d", fontSize: "12px" }}>
                                <strong>Responsible:</strong> {comp.responsible_person}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  } else if (comp.shape === 'line' && comp.line && comp.line.points) {
                    // Draw line overlay as SVG
                    const points = comp.line.points.map(pt => `${pt.x * zoom},${pt.y * zoom}`).join(' ');
                    return (
                      <svg
                        key={comp.name + idx}
                        data-rectidx={idx}
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: imgSize.width * zoom,
                          height: imgSize.height * zoom,
                          pointerEvents: relocateMode.active ? "auto" : "none",
                          zIndex: 2
                        }}
                        onMouseDown={relocateMode.active ? handleMouseDown : undefined}
                        // Attach drag logic to SVG for lines
                      >
                        <polyline
                          points={points}
                          fill="none"
                          stroke={relocateMode.active ? "#ffd700" : STATUS_COLORS[comp.status]}
                          strokeWidth={relocateMode.active ? 5 : 3}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          style={{ filter: relocateMode.active ? "drop-shadow(0 0 8px #ffd70088)" : undefined }}
                        />
                        {/* Add clickable area for edit/select */}
                        <polyline
                          points={points}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={relocateMode.active ? 40 : 15}
                          style={{ pointerEvents: "auto", cursor: relocateMode.active ? "grab" : (editMode ? "pointer" : "pointer") }}
                          onMouseDown={relocateMode.active ? handleMouseDown : (editMode ? () => handleRectClick(idx) : () => handleStatusChange(idx))}
                        />
                      </svg>
                    );
                  }
                  return null;
                })}
                {/* Ghost preview while drawing */}
                {editMode && drawing && rect && drawMode === 'rectangle' && (() => {
                  const { x1, y1, x2, y2 } = rect;
                  const left = Math.min(x1, x2) * zoom;
                  const top = Math.min(y1, y2) * zoom;
                  const width = Math.abs(x2 - x1) * zoom;
                  const height = Math.abs(y2 - y1) * zoom;
                  return (
                    <div
                      style={{
                        position: "absolute",
                        left,
                        top,
                        width,
                        height,
                        border: "3px dashed #3498db",
                        background: "rgba(52, 152, 219, 0.1)",
                        zIndex: 10,
                        pointerEvents: "none",
                        borderRadius: "4px"
                      }}
                    />
                  );
                })()}
                {editMode && drawing && rect && drawMode === 'circle' && (() => {
                  const { cx, cy, r } = rect;
                  return (
                    <div
                      style={{
                        position: "absolute",
                        left: (cx - r) * zoom,
                        top: (cy - r) * zoom,
                        width: r * 2 * zoom,
                        height: r * 2 * zoom,
                        border: "3px dashed #3498db",
                        borderRadius: "50%",
                        background: "rgba(52, 152, 219, 0.1)",
                        zIndex: 10,
                        pointerEvents: "none"
                      }}
                    />
                  );
                })()}
                {editMode && drawing && drawMode === 'line' && linePoints.length > 0 && (() => {
                  const points = linePoints.map(pt => `${pt.x * zoom},${pt.y * zoom}`).join(' ');
                  return (
                    <svg
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: imgSize.width * zoom,
                        height: imgSize.height * zoom,
                        pointerEvents: "none",
                        zIndex: 10
                      }}
                    >
                      <polyline
                        points={points}
                        fill="none"
                        stroke="#3498db"
                        strokeWidth={3}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeDasharray="6,4"
                      />
                    </svg>
                  );
                })()}
              </div>
            </div>
          </div>
        </Card>
        {/* Toolbar - now vertical, right of image */}
        <Card style={{
          minWidth: "220px",
          maxWidth: "260px",
          background: "rgba(255,255,255,0.98)",
          boxShadow: "0 4px 16px rgba(44, 62, 80, 0.10)",
          border: "2px solid #b0bec5",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: "24px",
          marginLeft: 0
        }}>
          <Button
            variant={editMode ? "danger" : "primary"}
            onClick={() => setEditMode((m) => !m)}
            style={{ minWidth: "140px", marginBottom: "8px" }}
          >
            {editMode ? "✕ Exit Edit Mode" : "✏️ Enter Edit Mode"}
          </Button>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleZoom(1.2)}
              style={{ width: "100%" }}
            >
              🔍+
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={() => handleZoom(1 / 1.2)}
              style={{ width: "100%" }}
            >
              🔍-
            </Button>
          </div>
          {/* Excel Download/Upload Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
            <Button
              variant="primary"
              size="small"
              onClick={() => {
                // Flatten JSON for Excel, EXCLUDE date_modified
                const rows = components.map(c => ({
                  projectTitle,
                  name: c.name,
                  status: c.status,
                  responsible_person: c.responsible_person,
                  shape: c.shape,
                  x1: c.rect?.x1 ?? '',
                  y1: c.rect?.y1 ?? '',
                  x2: c.rect?.x2 ?? '',
                  y2: c.rect?.y2 ?? '',
                  cx: c.circle?.cx ?? '',
                  cy: c.circle?.cy ?? '',
                  r: c.circle?.r ?? '',
                  points: c.line?.points?.map(p => `${p.x},${p.y}`).join(';') || ''
                }));
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Components");
                XLSX.writeFile(wb, `${projectTitle.replace(/[^a-zA-Z0-9]/g, '_') || 'project'}_components.xlsx`);
                setExcelModal({ open: true, message: "✅ Excel file downloaded successfully!" });
              }}
              style={{ width: "100%" }}
            >
              ⬇️ Download Excel
            </Button>
            <Button
              variant="secondary"
              size="small"
              style={{ width: "100%" }}
              onClick={() => document.getElementById("excel-upload-input").click()}
            >
              ⬆️ Upload Excel
            </Button>
            <input
              id="excel-upload-input"
              type="file"
              accept=".xlsx, .xls"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (evt) => {
                  const data = evt.target.result;
                  const workbook = XLSX.read(data, { type: "array" });
                  const sheet = workbook.Sheets[workbook.SheetNames[0]];
                  const rows = XLSX.utils.sheet_to_json(sheet);
                  // Convert rows to components JSON, add fresh date_modified
                  const newComponents = rows.map(row => {
                    let shape = row.shape;
                    let rect = null, circle = null, line = null;
                    if (shape === 'rectangle' || (!shape && row.x1 !== undefined && row.x2 !== undefined)) {
                      rect = {
                        x1: Number(row.x1) || 0,
                        y1: Number(row.y1) || 0,
                        x2: Number(row.x2) || 0,
                        y2: Number(row.y2) || 0
                      };
                      shape = 'rectangle';
                    } else if (shape === 'circle' || (!shape && row.cx !== undefined && row.r !== undefined)) {
                      circle = {
                        cx: Number(row.cx) || 0,
                        cy: Number(row.cy) || 0,
                        r: Number(row.r) || 0
                      };
                      shape = 'circle';
                    } else if ((shape === 'line' || (!shape && row.points)) && row.points) {
                      // Parse points as array of {x, y}, filter invalid, require at least 2
                      let points = [];
                      if (typeof row.points === 'string') {
                        // Accept both comma and semicolon as delimiters between points
                        const pointPairs = row.points.split(/;|\s+/).filter(Boolean);
                        points = pointPairs.map(pair => {
                          const [x, y] = pair.split(',').map(Number);
                          return (isFinite(x) && isFinite(y)) ? { x, y } : null;
                        }).filter(Boolean);
                        // Remove duplicate trailing points
                        for (let i = points.length - 1; i > 0; i--) {
                          if (points[i] && points[i - 1] && points[i].x === points[i - 1].x && points[i].y === points[i - 1].y) {
                            points.splice(i, 1);
                          }
                        }
                      }
                      if (points.length < 2) return null; // skip invalid lines
                      line = { points };
                      shape = 'line';
                    }
                    return {
                      name: row.name || '',
                      status: row.status || 'To Do',
                      date_modified: getLocalDateTime(),
                      responsible_person: row.responsible_person || '',
                      shape,
                      ...(rect ? { rect } : {}),
                      ...(circle ? { circle } : {}),
                      ...(line ? { line } : {})
                    };
                  }).filter(Boolean); // filter out nulls (invalid lines)
                  // Optionally update project title if present
                  if (rows[0]?.projectTitle) setProjectTitle(rows[0].projectTitle);
                  setComponents(newComponents);
                  await saveComponents(newComponents, rows[0]?.projectTitle || projectTitle);
                  setExcelModal({ open: true, message: "✅ Excel file uploaded and project updated!" });
                  e.target.value = '';
                };
                reader.readAsArrayBuffer(file);
              }}
            />
            {/* Clear All Points Button */}
            <Button
              variant="danger"
              size="small"
              style={{ width: "100%" }}
              onClick={() => setClearModal(true)}
            >
              🗑️ Clear All Points
            </Button>
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "12px",
            padding: "12px 0 0 0"
          }}>
            <span style={{ fontWeight: "600", color: "#2c3e50", marginBottom: "4px" }}>Legend:</span>
            {/* Draw Mode Selector */}
            <div style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 10,
              margin: "10px 0 14px 0",
              width: "100%"
            }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "#2c3e50", marginRight: 8 }}>Draw Mode:</span>
              {SHAPE_MODES.map((mode) => (
                <button
                  key={mode.key}
                  title={mode.label}
                  style={{
                    background: drawMode === mode.key ? "#3498db" : "#ecf0f1",
                    color: drawMode === mode.key ? "white" : "#2c3e50",
                    border: drawMode === mode.key ? "2px solid #2980b9" : "2px solid #bdc3c7",
                    borderRadius: "50%",
                    width: 36,
                    height: 36,
                    fontSize: 20,
                    fontWeight: 700,
                    cursor: "pointer",
                    outline: drawMode === mode.key ? "2px solid #764ba2" : "none",
                    boxShadow: drawMode === mode.key ? "0 2px 8px #764ba233" : "none",
                    transition: "all 0.2s"
                  }}
                  onClick={() => setDrawMode(mode.key)}
                >
                  {mode.icon}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: STATUS_COLORS["Done"]
                }}></div>
                <span style={{ fontSize: "14px", color: "#2c3e50" }}>Done</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: STATUS_COLORS["Doing"]
                }}></div>
                <span style={{ fontSize: "14px", color: "#2c3e50" }}>Doing</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: STATUS_COLORS["To Do"]
                }}></div>
                <span style={{ fontSize: "14px", color: "#2c3e50" }}>To Do</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

            {/* Enhanced Modal */}
        {editMode && modal.open && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
            background: "rgba(0,0,0,0.5)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)"
          }}
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            style={{
              minWidth: "400px",
              maxWidth: "500px",
              background: "white",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
            }}
          >
            <h3 style={{
              margin: "0 0 24px 0",
              color: "#2c3e50",
              fontSize: "1.5rem",
              fontWeight: "600"
            }}>
              {modal.idx !== null ? "✏️ Edit Component" : "➕ Add Component"}
            </h3>
            
            <form onSubmit={handleFormSubmit} onClick={(e) => e.stopPropagation()}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "600",
                  color: "#2c3e50"
                }}>
                  Name/Type:
                </label>
                <input
                  required
                  list="name-options"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.style.borderColor = "#3498db"}
                  onBlur={(e) => e.target.style.borderColor = "#e9ecef"}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #e9ecef",
                    borderRadius: "8px",
                    fontSize: "16px",
                    transition: "border-color 0.2s ease",
                    boxSizing: "border-box"
                  }}
                />
                <datalist id="name-options">
                  {nameOptions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                  {/* Always include current form value if it exists and is not empty */}
                  {form.name && form.name.trim() !== '' && !nameOptions.includes(form.name) && (
                    <option key={form.name} value={form.name} />
                  )}
                </datalist>
              </div>
              
              <div style={{ marginBottom: "24px" }}>
                <label style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "600",
                  color: "#2c3e50"
                }}>
                  Responsible Person:
                </label>
                <input
                  list="person-options"
                  value={form.responsible_person}
                  onChange={e => setForm(f => ({ ...f, responsible_person: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.style.borderColor = "#3498db"}
                  onBlur={(e) => e.target.style.borderColor = "#e9ecef"}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #e9ecef",
                    borderRadius: "8px",
                    fontSize: "16px",
                    transition: "border-color 0.2s ease",
                    boxSizing: "border-box"
                  }}
                />
                <datalist id="person-options">
                  {personOptions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                  {/* Always include current form value if it exists and is not empty */}
                  {form.responsible_person && form.responsible_person.trim() !== '' && !personOptions.includes(form.responsible_person) && (
                    <option key={form.responsible_person} value={form.responsible_person} />
                  )}
                </datalist>
              </div>
              
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px"
              }}>
                {modal.idx !== null && (
                  <Button
                    variant="danger"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(e);
                    }}
                    style={{ flex: 1 }}
                  >
                    🗑️ Delete
                  </Button>
                )}
                {/* Reposition Button */}
                {modal.idx !== null && (
                  <Button
                    variant="primary"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Store original shape for cancel
                      setRelocateOriginalShape(JSON.parse(JSON.stringify(components[modal.idx])));
                      setModal({ open: false, rect: null, idx: null });
                      setRelocateMode({ active: true, idx: modal.idx, original: components[modal.idx] });
                    }}
                    style={{ flex: 1 }}
                  >
                    Reposition
                  </Button>
                )}
                <div style={{ display: "flex", gap: "12px", flex: modal.idx !== null ? 1 : 1 }}>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={handleCancelModal}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="success"
                    type="submit"
                    onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1 }}
                  >
                    {modal.idx !== null ? "💾 Save" : "➕ Add"}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Enhanced Summary Table */}
      <div style={{
        maxWidth: "1200px",
        margin: "32px auto 0 auto"
      }}>
        <Card style={{ background: "rgba(255,255,255,0.95)" }}>
          <h3 style={{
            textAlign: "center",
            margin: "0 0 24px 0",
            color: "#2c3e50",
            fontSize: "1.8rem",
            fontWeight: "600"
          }}>
             Component Summary by Type
          </h3>
          
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "white",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
            }}>
              <thead>
                <tr style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white"
                }}>
                  <th style={{
                    padding: "16px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    fontSize: "14px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                  onClick={() => handleSort("name", false)}
                  >
                    Component Type
                    <span style={{ marginLeft: 6, fontSize: 13, transition: "transform 0.2s", color: sortConfig.key === "name" ? "#ffd700" : "#fff", transform: sortConfig.key === "name" && sortConfig.direction === "desc" ? "rotate(180deg)" : "none" }}>
                      {sortConfig.key === "name" ? (sortConfig.direction === "asc" ? "🔼" : "🔽") : "⬍"}
                    </span>
                  </th>
                  <th style={{
                    padding: "16px 12px",
                    textAlign: "center",
                    fontWeight: "600",
                    fontSize: "14px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                  onClick={() => handleSort("count", true)}
                  >
                    Total
                    <span style={{ marginLeft: 6, fontSize: 13, transition: "transform 0.2s", color: sortConfig.key === "count" ? "#ffd700" : "#fff", transform: sortConfig.key === "count" && sortConfig.direction === "desc" ? "rotate(180deg)" : "none" }}>
                      {sortConfig.key === "count" ? (sortConfig.direction === "asc" ? "🔼" : "🔽") : "⬍"}
                    </span>
                  </th>
                  <th style={{
                    padding: "16px 12px",
                    textAlign: "center",
                    fontWeight: "600",
                    fontSize: "14px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                  onClick={() => handleSort("todo", true)}
                  >
                    To Do
                    <span style={{ marginLeft: 6, fontSize: 13, transition: "transform 0.2s", color: sortConfig.key === "todo" ? "#ffd700" : "#fff", transform: sortConfig.key === "todo" && sortConfig.direction === "desc" ? "rotate(180deg)" : "none" }}>
                      {sortConfig.key === "todo" ? (sortConfig.direction === "asc" ? "🔼" : "🔽") : "⬍"}
                    </span>
                  </th>
                  <th style={{
                    padding: "16px 12px",
                    textAlign: "center",
                    fontWeight: "600",
                    fontSize: "14px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                  onClick={() => handleSort("doing", true)}
                  >
                    In Progress
                    <span style={{ marginLeft: 6, fontSize: 13, transition: "transform 0.2s", color: sortConfig.key === "doing" ? "#ffd700" : "#fff", transform: sortConfig.key === "doing" && sortConfig.direction === "desc" ? "rotate(180deg)" : "none" }}>
                      {sortConfig.key === "doing" ? (sortConfig.direction === "asc" ? "🔼" : "🔽") : "⬍"}
                    </span>
                  </th>
                  <th style={{
                    padding: "16px 12px",
                    textAlign: "center",
                    fontWeight: "600",
                    fontSize: "14px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                  onClick={() => handleSort("done", true)}
                  >
                    Done
                    <span style={{ marginLeft: 6, fontSize: 13, transition: "transform 0.2s", color: sortConfig.key === "done" ? "#ffd700" : "#fff", transform: sortConfig.key === "done" && sortConfig.direction === "desc" ? "rotate(180deg)" : "none" }}>
                      {sortConfig.key === "done" ? (sortConfig.direction === "asc" ? "🔼" : "🔽") : "⬍"}
                    </span>
                  </th>
                  <th style={{
                    padding: "16px 12px",
                    textAlign: "center",
                    fontWeight: "600",
                    fontSize: "14px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                  onClick={() => handleSort("percent", true)}
                  >
                    Progress
                    <span style={{ marginLeft: 6, fontSize: 13, transition: "transform 0.2s", color: sortConfig.key === "percent" ? "#ffd700" : "#fff", transform: sortConfig.key === "percent" && sortConfig.direction === "desc" ? "rotate(180deg)" : "none" }}>
                      {sortConfig.key === "percent" ? (sortConfig.direction === "asc" ? "🔼" : "🔽") : "⬍"}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row, index) => {
                  const { name, count, todo, doing, done, percent } = row;
                  return (
                    <tr key={name} style={{
                      background: index % 2 === 0 ? "#f8f9fa" : "white",
                      transition: "background-color 0.2s ease"
                    }}
                    onMouseEnter={(e) => e.target.parentElement.style.background = "#e3f2fd"}
                    onMouseLeave={(e) => e.target.parentElement.style.background = index % 2 === 0 ? "#f8f9fa" : "white"}
                    >
                      <td style={{
                        padding: "16px 12px",
                        fontWeight: "600",
                        color: "#2c3e50",
                        borderBottom: "1px solid #e9ecef"
                      }}>
                        {name}
                      </td>
                      <td style={{
                        padding: "16px 12px",
                        textAlign: "center",
                        fontWeight: "600",
                        color: "#2c3e50",
                        borderBottom: "1px solid #e9ecef"
                      }}>
                        {count}
                      </td>
                      <td style={{
                        padding: "16px 12px",
                        textAlign: "center",
                        borderBottom: "1px solid #e9ecef"
                      }}>
                        <span style={{
                          background: STATUS_COLORS["To Do"],
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}>
                          {todo}
                        </span>
                      </td>
                      <td style={{
                        padding: "16px 12px",
                        textAlign: "center",
                        borderBottom: "1px solid #e9ecef"
                      }}>
                        <span style={{
                          background: STATUS_COLORS["Doing"],
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}>
                          {doing}
                        </span>
                      </td>
                      <td style={{
                        padding: "16px 12px",
                        textAlign: "center",
                        borderBottom: "1px solid #e9ecef"
                      }}>
                        <span style={{
                          background: STATUS_COLORS["Done"],
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}>
                          {done}
                        </span>
                      </td>
                      <td style={{
                        padding: "16px 12px",
                        textAlign: "center",
                        borderBottom: "1px solid #e9ecef",
                        minWidth: "150px"
                      }}>
                        <ProgressBar value={percent} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {/* Clear All Points Modal */}
      {clearModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)"
          }}
        >
          <Card
            style={{
              minWidth: "400px",
              maxWidth: "500px",
              background: "white",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              zIndex: 2100
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{
              margin: "0 0 18px 0",
              color: "#c0392b",
              fontSize: "1.5rem",
              fontWeight: "700"
            }}>
              Are you sure?
            </h3>
            <p style={{ color: "#2c3e50", fontSize: "1.1rem", marginBottom: 24 }}>
              This will remove all points from the current project. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "flex-end" }}>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setClearModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={async () => {
                  setClearModal(false);
                  setComponents([]);
                  await saveComponents([], projectTitle);
                  setExcelModal({ open: true, message: "✅ All points have been cleared." });
                }}
                style={{ flex: 1 }}
              >
                Yes, clear
              </Button>
            </div>
          </Card>
        </div>
      )}
      {/* Excel Download/Upload/Clear Confirmation Modal */}
      {excelModal.open && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            zIndex: 2500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)"
          }}
        >
          <Card
            style={{
              minWidth: "340px",
              maxWidth: "400px",
              background: "white",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              zIndex: 2600,
              textAlign: "center"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: "2.2rem", marginBottom: 12 }}>✅</div>
            <div style={{ color: "#2c3e50", fontSize: "1.2rem", fontWeight: 600, marginBottom: 24 }}>{excelModal.message}</div>
            <Button
              variant="primary"
              type="button"
              onClick={() => setExcelModal({ open: false, message: "" })}
              style={{ minWidth: 100 }}
            >
              OK
            </Button>
          </Card>
        </div>
      )}
      {/* Floating Drawing Instruction */}
      {drawingInstruction && (
        <div style={{
          position: "fixed",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#3498db",
          color: "white",
          padding: "10px 24px",
          borderRadius: 10,
          fontWeight: 600,
          fontSize: 16,
          boxShadow: "0 2px 12px #3498db33",
          zIndex: 4000
        }}>
          {drawingInstruction}
        </div>
      )}
      {/* Floating Relocation Instruction */}
      {relocateMode.active && (
        <div style={{
          position: "fixed",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#ffd700",
          color: "#2c3e50",
          padding: "10px 24px",
          borderRadius: 10,
          fontWeight: 700,
          fontSize: 16,
          boxShadow: "0 2px 12px #ffd70033",
          zIndex: 4100
        }}>
          Drag the shape to reposition, then release to confirm
        </div>
      )}
    </div>
  );
} 