import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function UploadPage() {
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const navigate = useNavigate();

  const handleFile = async (file) => {
    setLoading(true);
    setProgressMsg("🚀 Uploading your blueprint...");

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      setProgressMsg("🛠️ Converting PDF to images.");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.images) {
        setProgressMsg("🎉 Conversion complete! Redirecting to gallery...");
        // Wait a bit longer to ensure backend has written files
        setTimeout(() => navigate("/gallery"), 2000); // Increased delay
      } else {
        setProgressMsg("❌ Something went wrong.");
      }
    } catch {
      setProgressMsg("❌ Upload failed.");
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
      <h1 style={{ color: "white", fontSize: "2.5rem", marginBottom: 24 }}>Upload Electrical Layout PDF</h1>
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 40,
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          textAlign: "center",
          minWidth: 350,
        }}
        onDrop={e => {
          e.preventDefault();
          if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        }}
        onDragOver={e => e.preventDefault()}
      >
        <input
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          id="pdf-upload"
          onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
        />
        <label htmlFor="pdf-upload" style={{ cursor: "pointer", color: "#3498db", fontWeight: 600, fontSize: 18 }}>
          Click to select a PDF or drag it here
        </label>
        <br />
        <br />
        {loading && (
          <div style={{ marginTop: 24, fontSize: 20, color: "#764ba2" }}>
            <div className="loader" style={{ marginBottom: 12 }} />
            {progressMsg}
          </div>
        )}
      </div>
      <button
        style={{
          marginTop: 32,
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
        onClick={() => navigate("/gallery")}
      >
        Go to Gallery
      </button>
    </div>
  );
} 