import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function fetchProjectTitle(img) {
  // Use the backend API endpoint to always get the latest data
  return fetch(`/api/components?image=${encodeURIComponent(img)}`)
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) return "Untitled Project";
      return (data && data.projectTitle) || "Untitled Project";
    })
    .catch(() => "Untitled Project");
}

async function saveProjectTitle(img, title) {
  // Fetch the current JSON, update the title, and PUT it back
  const url = `/components_${img.replace(/\.png$/, '')}.json?v=${Date.now()}`;
  let data;
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch {
    data = { projectTitle: title, components: [] };
  }
  if (Array.isArray(data)) {
    data = { projectTitle: title, components: data };
  } else {
    data.projectTitle = title;
    if (!Array.isArray(data.components)) data.components = [];
  }
  await fetch(`/api/components?image=${encodeURIComponent(img)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export default function GalleryPage() {
  const [images, setImages] = useState([]);
  const [titles, setTitles] = useState({});
  const [editing, setEditing] = useState(null); // {img, value}
  const [deleting, setDeleting] = useState(null); // img
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    fetch(`/api/images?v=${Date.now()}`)
      .then(res => res.json())
      .then(async imgs => {
        const filtered = imgs.filter(img => img !== 'logo192.png' && img !== 'logo512.png');
        setImages(filtered);
        // Fetch all titles in parallel
        const entries = await Promise.all(filtered.map(async img => [img, await fetchProjectTitle(img)]));
        if (mounted) setTitles(Object.fromEntries(entries));
      });
    return () => { mounted = false; };
  }, [location.key]);

  const handleEditTitle = useCallback((img) => {
    setEditing({ img, value: titles[img] || "" });
  }, [titles]);

  const handleEditChange = (e) => {
    setEditing(editing => ({ ...editing, value: e.target.value }));
  };

  const handleEditSave = async () => {
    setLoading(true);
    try {
      await fetch('/api/project-title', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: editing.img, title: editing.value })
      });
      // Also update the JSON file directly for persistence
      await saveProjectTitle(editing.img, editing.value);
      // Re-fetch images and titles to ensure UI is up to date
      const imgs = await fetch(`/api/images?v=${Date.now()}`).then(res => res.json());
      const filtered = imgs.filter(img => img !== 'logo192.png' && img !== 'logo512.png');
      setImages(filtered);
      const entries = await Promise.all(filtered.map(async img => [img, await fetchProjectTitle(img)]));
      setTitles(Object.fromEntries(entries));
      setEditing(null);
    } catch (e) {
      alert('Failed to update title');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (img) => setDeleting(img);

  const confirmDelete = async () => {
    setLoading(true);
    try {
      await fetch('/api/project', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: deleting })
      });
      setImages(imgs => imgs.filter(i => i !== deleting));
      setDeleting(null);
    } catch (e) {
      alert('Failed to delete project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", padding: 40 }}>
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
      <h1 style={{ color: "white", textAlign: "center", marginBottom: 32 }}>Gallery</h1>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 32,
        maxWidth: 1200,
        margin: "0 auto"
      }}>
        {images.map(img => (
          <div key={img} style={{
            background: "white",
            borderRadius: 16,
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative"
          }}>
            {/* Project Title + Edit */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12, width: "100%", justifyContent: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 18, marginRight: 8 }}>{titles[img] || "Untitled Project"}</span>
              <button
                style={{ marginLeft: 4, fontSize: 14, padding: "2px 10px", borderRadius: 6, border: "1px solid #764ba2", background: "#f3eaff", color: "#764ba2", cursor: "pointer" }}
                onClick={() => handleEditTitle(img)}
              >Edit Title</button>
            </div>
            <img src={`/images/${img}`} alt={img} style={{ width: "100%", maxWidth: 300, borderRadius: 8, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
            <div style={{ fontWeight: 600, marginBottom: 12 }}>{img}</div>
            <button
              style={{
                background: "linear-gradient(90deg, #667eea, #764ba2)",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                marginBottom: 8
              }}
              onClick={() => navigate(`/dashboard?image=${encodeURIComponent(img)}`)}
            >
              Select
            </button>
            <button
              style={{
                position: "absolute",
                bottom: 16,
                right: 16,
                background: "#ff4d4f",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)"
              }}
              onClick={() => handleDelete(img)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      {/* Edit Title Modal */}
      {editing && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", borderRadius: 12, padding: 32, minWidth: 320, boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}>
            <h2>Edit Project Title</h2>
            <input
              value={editing.value}
              onChange={handleEditChange}
              style={{ width: "100%", fontSize: 16, padding: 8, marginBottom: 16, borderRadius: 6, border: "1px solid #ccc" }}
              disabled={loading}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button onClick={() => setEditing(null)} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #764ba2", background: "#fff", color: "#764ba2", fontWeight: 600, cursor: "pointer" }} disabled={loading}>Cancel</button>
              <button onClick={handleEditSave} style={{ padding: "8px 18px", borderRadius: 6, background: "#764ba2", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer" }} disabled={loading || !editing.value.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleting && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", borderRadius: 12, padding: 32, minWidth: 320, boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}>
            <h2>Delete Project</h2>
            <p>Are you sure you want to delete this project? This action cannot be undone.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button onClick={() => setDeleting(null)} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #764ba2", background: "#fff", color: "#764ba2", fontWeight: 600, cursor: "pointer" }} disabled={loading}>Cancel</button>
              <button onClick={confirmDelete} style={{ padding: "8px 18px", borderRadius: 6, background: "#ff4d4f", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer" }} disabled={loading}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 