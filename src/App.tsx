import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Editor } from "./components/Editor";
import { Preview } from "./components/Preview";
import "./App.css";

type AppMode = "editor" | "preview";

function App() {
  const [mode, setMode] = useState<AppMode>("editor");

  useEffect(() => {
    // Check URL params for mode
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get("mode");
    if (urlMode === "preview") {
      setMode("preview");
    }
  }, []);

  const handleOpenEditor = async () => {
    // Open main editor window and close preview
    await invoke("show_editor_window");
    await invoke("hide_preview_window");
  };

  if (mode === "preview") {
    return <Preview onOpenEditor={handleOpenEditor} />;
  }

  return <Editor />;
}

export default App;
