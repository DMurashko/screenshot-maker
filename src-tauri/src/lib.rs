#![allow(unused_must_use)]

use base64::{engine::general_purpose::STANDARD, Engine};
use screenshots::image::ImageFormat;
use screenshots::Screen;
use std::io::Cursor;
use std::sync::Mutex;
use tauri::{
    image::Image,
    tray::{ TrayIconBuilder},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};

// Store the latest screenshot as base64
struct ScreenshotState {
    current_screenshot: Mutex<Option<String>>,
}

#[tauri::command]
fn take_screenshot(app: AppHandle, state: tauri::State<ScreenshotState>) -> Result<String, String> {
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

    // Convert to base64
    let base64_image = STANDARD.encode(&png_bytes);
    let data_url = format!("data:image/png;base64,{}", base64_image);

    // Store in state
    *state.current_screenshot.lock().unwrap() = Some(data_url.clone());

    // Emit event to frontend
    let _ = app.emit("screenshot-taken", &data_url);

    Ok(data_url)
}

#[tauri::command]
fn get_current_screenshot(state: tauri::State<ScreenshotState>) -> Option<String> {
    state.current_screenshot.lock().unwrap().clone()
}

#[tauri::command]
fn show_editor_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_preview_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("preview") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn show_preview_window(app: &AppHandle) -> Result<(), String> {
    // Close existing preview window if any
    if let Some(window) = app.get_webview_window("preview") {
        let _ = window.close();
    }

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

fn trigger_screenshot(app: &AppHandle) {
    let app_handle = app.clone();
    std::thread::spawn(move || {
        // Small delay to allow key release
        std::thread::sleep(std::time::Duration::from_millis(100));

        let state = app_handle.state::<ScreenshotState>();
        if let Ok(data_url) = take_screenshot(app_handle.clone(), state) {
            let _ = show_preview_window(&app_handle);
            let _ = app_handle.emit("screenshot-taken", &data_url);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(ScreenshotState {
            current_screenshot: Mutex::new(None),
        })
        .setup(|app| {
            // Set macOS activation policy to accessory (menu bar app, no dock)
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            // Build tray icon
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(Image::from_path("icons/32x32.png").unwrap_or_else(|_| {
                    app.default_window_icon().unwrap().clone()
                }))
                .show_menu_on_left_click(true)
                .on_tray_icon_event(|tray, event| {
                    use tauri::tray::TrayIconEvent;
                    use tauri::tray::{MouseButton, MouseButtonState};
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    window.hide();
                                } else {
                                    window.show();
                                    window.set_focus();
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Register global shortcut Ctrl+Alt+S
            let app_handle = app.handle().clone();
            use tauri_plugin_global_shortcut::GlobalShortcutExt;

            app.global_shortcut().on_shortcut("ctrl+alt+s", move |_app, _shortcut, _event| {
                trigger_screenshot(&app_handle);
            })?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            take_screenshot,
            get_current_screenshot,
            show_editor_window,
            hide_preview_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
