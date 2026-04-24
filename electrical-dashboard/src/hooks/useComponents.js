import { useEffect, useState, useMemo } from "react";

export default function useComponents(image = "page_1.png") {
  const [components, setComponents] = useState([]);
  const [projectTitle, setProjectTitle] = useState("Untitled Project");
  // Always use a components file that matches the image name
  const base = image ? image.replace(/\.[^.]+$/, '') : 'page_1';
  // Use useMemo to stabilize apiUrl
  const apiUrl = useMemo(() => `http://localhost:4000/api/components?image=${encodeURIComponent(base + '.png')}`,[base]);

  useEffect(() => {
    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setComponents(data);
          setProjectTitle("Untitled Project");
        } else {
          setComponents(data.components || []);
          setProjectTitle(data.projectTitle || "Untitled Project");
        }
      })
      .catch(() => {
        setComponents([]);
        setProjectTitle("Untitled Project");
      });
  }, [apiUrl]);

  const saveComponents = async (next, title = projectTitle) => {
    try {
      const res = await fetch(apiUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectTitle: title, components: next }),
      });
      return res;
    } catch (e) {
      console.error("Failed to save components", e);
    }
  };

  return [components, setComponents, saveComponents, projectTitle, setProjectTitle];
} 