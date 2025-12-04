import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./Preview.css";

interface PreviewProps {
  onOpenEditor: () => void;
}

export function Preview({ onOpenEditor }: PreviewProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Get current screenshot on mount
    invoke<string | null>("get_current_screenshot").then((data) => {
      if (data) {
        setScreenshot(data);
        setIsVisible(true);
      }
    });

    // Listen for new screenshots
    const unlisten = listen<string>("screenshot-taken", (event) => {
      setScreenshot(event.payload);
      setIsVisible(true);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleClick = () => {
    onOpenEditor();
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    await invoke("hide_preview_window");
  };

  if (!isVisible || !screenshot) {
    return null;
  }

  return (
    <div className="preview-container" onClick={handleClick}>
      <button className="preview-close" onClick={handleClose}>
        ×
      </button>
      <img src={screenshot} alt="Screenshot preview" className="preview-image" />
      <div className="preview-hint">Click to edit</div>
    </div>
  );
}

