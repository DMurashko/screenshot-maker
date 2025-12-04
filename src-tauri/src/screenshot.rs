use base64::{engine::general_purpose::STANDARD, Engine};
use screenshots::image::ImageFormat;
use screenshots::Screen;
use std::io::Cursor;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// Manages the state of the current screenshot
pub struct ScreenshotState {
    pub current_screenshot: Mutex<Option<String>>,
}

impl ScreenshotState {
    /// Creates a new empty screenshot state
    pub fn new() -> Self {
        Self {
            current_screenshot: Mutex::new(None),
        }
    }
}

impl Default for ScreenshotState {
    fn default() -> Self {
        Self::new()
    }
}

/// Captures a screenshot from the primary screen and converts it to a base64 data URL
pub fn capture_screenshot_as_data_url() -> Result<Vec<u8>, String> {
    let screens = Screen::all().map_err(|e| e.to_string())?;

    if screens.is_empty() {
        return Err("No screens found".to_string());
    }

    // Capture the primary screen (first screen)
    let screen = &screens[0];
    let image = screen.capture().map_err(|e| e.to_string())?;

    // Convert to PNG bytes
    let mut png_bytes: Vec<u8> = Vec::new();
    image
        .write_to(&mut Cursor::new(&mut png_bytes), ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    Ok(png_bytes)
}

/// Converts PNG bytes to base64 data URL
fn encode_to_data_url(png_bytes: &[u8]) -> String {
    let base64_image = STANDARD.encode(png_bytes);
    format!("data:image/png;base64,{}", base64_image)
}

/// Stores the screenshot in the application state and emits an event
fn store_and_emit_screenshot(
    app: &AppHandle,
    state: &tauri::State<ScreenshotState>,
    data_url: &str,
) {
    *state.current_screenshot.lock().unwrap() = Some(data_url.to_string());
    app.emit("screenshot-taken", data_url);
}

/// Tauri command: Captures a screenshot and returns it as a base64 data URL
#[tauri::command]
pub fn take_screenshot(
    app: AppHandle,
    state: tauri::State<ScreenshotState>,
) -> Result<String, String> {
    let png_bytes = capture_screenshot_as_data_url()?;
    let data_url = encode_to_data_url(&png_bytes);
    store_and_emit_screenshot(&app, &state, &data_url);
    Ok(data_url)
}

/// Tauri command: Retrieves the currently stored screenshot
#[tauri::command]
pub fn get_current_screenshot(state: tauri::State<ScreenshotState>) -> Option<String> {
    state.current_screenshot.lock().unwrap().clone()
}

/// Creates and displays the preview window at the bottom-right corner of the primary monitor
fn create_preview_window(app: &AppHandle) -> Result<(), String> {
    // Get primary monitor size for positioning
    let (x, y) = if let Some(monitor) = app.primary_monitor().ok().flatten() {
        let size = monitor.size();
        let position = monitor.position();
        (
            position.x as f64 + size.width as f64 - 320.0 - 20.0,
            position.y as f64 + size.height as f64 - 200.0 - 60.0,
        )
    } else {
        (1580.0, 820.0) // Default position
    };

    // Create preview window
    let _preview_window = WebviewWindowBuilder::new(
        app,
        "preview",
        WebviewUrl::App("index.html?mode=preview".into()),
    )
    .title("Screenshot Preview")
    .inner_size(300.0, 180.0)
    .position(x, y)
    .decorations(false)
    .always_on_top(true)
    .resizable(false)
    .skip_taskbar(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Shows the preview window, closing any existing preview window first
pub fn show_preview_window(app: &AppHandle) -> Result<(), String> {
    // Close existing preview window if any
    if let Some(window) = app.get_webview_window("preview") {
        let _ = window.close();
    }

    create_preview_window(app)
}

/// Tauri command: Hides/closes the preview window
#[tauri::command]
pub fn hide_preview_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("preview") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Tauri command: Shows the editor window
#[tauri::command]
pub fn show_editor_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Triggers a screenshot capture in a background thread with a small delay
pub fn trigger_screenshot(app: &AppHandle) {
    let app_handle = app.clone();
    std::thread::spawn(move || {
        // Small delay to allow key release
        std::thread::sleep(std::time::Duration::from_millis(100));

        let state = app_handle.state::<ScreenshotState>();
        if let Ok(_data_url) = take_screenshot(app_handle.clone(), state) {
            let _ = show_preview_window(&app_handle);
        }
    });
}
