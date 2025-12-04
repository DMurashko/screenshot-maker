#![allow(unused_must_use)]

mod screenshot;
mod tray;

use screenshot::{
    ScreenshotState, get_current_screenshot, hide_preview_window, show_editor_window,
    take_screenshot, trigger_screenshot,
};
use tray::initialize_tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(ScreenshotState::new())
        .setup(|app| {
            // Set macOS activation policy to accessory (menu bar app, no dock)
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            // Initialize tray icon
            initialize_tray(app)?;

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
