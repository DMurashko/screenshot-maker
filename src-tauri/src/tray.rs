use tauri::{
    image::Image,
    tray::TrayIconBuilder,
    App, Manager,
};

/// Initializes the tray icon with click handlers
pub fn initialize_tray(app: &App) -> Result<(), tauri::Error> {
    app.handle();
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
                    handle_tray_click(tray.app_handle());
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

/// Handles the tray icon click event by toggling window visibility
fn handle_tray_click(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            window.hide();
        } else {
            window.show();
            let _ = window.set_focus();
        }
    }
}
