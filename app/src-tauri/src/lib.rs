#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

/// Bring the main window back from the tray (or from behind other windows).
#[cfg(desktop)]
fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Remember the window's size and place a moment after it last changed (the plugin only saves on exit, and an app
/// that lives in the tray may not exit for days, or may be ended from the task manager).
#[cfg(desktop)]
fn remember_window(window: &tauri::Window, event: &tauri::WindowEvent) {
    use std::sync::atomic::{AtomicU64, Ordering};
    use tauri_plugin_window_state::{AppHandleExt, StateFlags};
    static LATEST: AtomicU64 = AtomicU64::new(0);
    if window.label() != "main" {
        return;
    }
    if !matches!(
        event,
        tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) | tauri::WindowEvent::CloseRequested { .. }
    ) {
        return;
    }
    let mine = LATEST.fetch_add(1, Ordering::SeqCst) + 1;
    let app = window.app_handle().clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(400));
        if LATEST.load(Ordering::SeqCst) != mine {
            return; // it moved again: the last change saves
        }
        // a minimised window reports a far-off place and no size: keep the last good one
        if let Some(w) = app.get_webview_window("main") {
            if w.is_minimized().unwrap_or(false) {
                return;
            }
        }
        let _ = app.save_window_state(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED);
    });
}

/// Bring the window back inside the screen. After the display scaling changes (or a window restored onto a smaller
/// screen) it can be larger than the work area, or sit partly outside it, which hides the title bar and its buttons.
#[cfg(desktop)]
fn fit_window(w: &tauri::WebviewWindow) {
    use tauri::{PhysicalPosition, PhysicalSize};
    if w.is_maximized().unwrap_or(false) || w.is_fullscreen().unwrap_or(false) || w.is_minimized().unwrap_or(false) {
        return;
    }
    let (Ok(Some(monitor)), Ok(pos), Ok(size)) = (w.current_monitor(), w.outer_position(), w.outer_size()) else {
        return;
    };
    let area = monitor.work_area();
    let (ax, ay) = (area.position.x, area.position.y);
    let (aw, ah) = (area.size.width as i32, area.size.height as i32);
    let width = (size.width as i32).min(aw);
    let height = (size.height as i32).min(ah);
    let x = pos.x.clamp(ax, (ax + aw - width).max(ax));
    let y = pos.y.clamp(ay, (ay + ah - height).max(ay));
    if width != size.width as i32 || height != size.height as i32 {
        let _ = w.set_size(PhysicalSize::new(width as u32, height as u32));
    }
    if x != pos.x || y != pos.y {
        let _ = w.set_position(PhysicalPosition::new(x, y));
    }
}

/// A change of display scaling: once the system has resized the window for it, check it still fits the screen.
#[cfg(desktop)]
fn rescaled(window: &tauri::Window, event: &tauri::WindowEvent) {
    if window.label() != "main" || !matches!(event, tauri::WindowEvent::ScaleFactorChanged { .. }) {
        return;
    }
    let app = window.app_handle().clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        if let Some(w) = app.get_webview_window("main") {
            fit_window(&w);
        }
    });
}

#[cfg(desktop)]
fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Quran", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Quran")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // the single-instance plugin has to come first
    #[cfg(desktop)]
    let builder = builder
        // only one Quran at a time: opening it again brings the running one back (from the tray too)
        // (this must be the first plugin)
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if !args.iter().any(|a| a == "--hidden") {
                show_main(app);
            }
        }))
        .on_window_event(|window, event| {
            remember_window(window, event);
            rescaled(window, event);
        });

    let builder = builder.plugin(tauri_plugin_opener::init());

    // Desktop-only plugins: in-app updates, the restart that finishes one, reminder notifications,
    // the window's size and place from last time, and starting with the computer (into the tray).
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            // not VISIBLE: a window that was hidden in the tray when the app quit must still open next time
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .setup(|app| {
            build_tray(app)?;
            // restored onto a screen with other scaling or size than last time: keep the title bar reachable
            if let Some(w) = app.get_webview_window("main") {
                fit_window(&w);
            }
            // started with the computer: stay in the tray until the reader opens the app
            if std::env::args().any(|a| a == "--hidden") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            Ok(())
        });

    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // clicking the Dock icon brings the window back after it was closed to the tray
            #[cfg(target_os = "macos")]
            {
                if let tauri::RunEvent::Reopen { .. } = event {
                    show_main(app);
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app, event);
            }
        });
}
