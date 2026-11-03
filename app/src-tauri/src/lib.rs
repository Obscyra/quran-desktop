#[cfg(desktop)]
mod media;

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

/// Opens the web inspector (Ctrl/Cmd+Shift+I): the page hides the system right-click menu, so Inspect is not offered there.
#[tauri::command]
fn open_inspector(window: tauri::WebviewWindow) {
    window.open_devtools();
}

/// Read the country out of a POSIX locale such as `en_BD.UTF-8`, `en-BD` or `sr_RS@latin`.
#[cfg(unix)]
fn region_from_locale(raw: &str) -> Option<String> {
    let base = raw.trim().split(|c| c == '.' || c == '@').next()?;
    let mut parts = base.split(|c| c == '_' || c == '-');
    let _language = parts.next()?;
    let region = parts.next()?;
    if region.len() == 2 && region.chars().all(|c| c.is_ascii_alphabetic()) {
        Some(region.to_ascii_uppercase())
    } else {
        None
    }
}

/// Linux and the other Unix systems keep the country in the locale (`LANG=bn_BD.UTF-8`). Desktop environments that
/// separate language from region put the region in the format categories (`LC_TIME`, `LC_NUMERIC`), so those are
/// checked first; `LC_ALL` wins over everything.
#[cfg(unix)]
fn locale_region() -> Option<String> {
    for key in [
        "LC_ALL",
        "LC_TIME",
        "LC_NUMERIC",
        "LC_MONETARY",
        "LC_MEASUREMENT",
        "LC_PAPER",
        "LANG",
        "LC_MESSAGES",
    ] {
        if let Ok(value) = std::env::var(key) {
            if let Some(region) = region_from_locale(&value) {
                return Some(region);
            }
        }
    }
    None
}

/// macOS keeps the region in `AppleLocale` (`en_BD`), or overrides it with `@rg=bdzzzz`.
#[cfg(target_os = "macos")]
fn apple_region() -> Option<String> {
    let out = std::process::Command::new("/usr/bin/defaults")
        .args(["read", "-g", "AppleLocale"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&out.stdout);
    let raw = raw.trim().trim_matches('"');
    if let Some(at) = raw.find("@rg=") {
        let code: String = raw[at + 4..].chars().take(2).collect();
        if code.len() == 2 && code.chars().all(|c| c.is_ascii_alphabetic()) {
            return Some(code.to_ascii_uppercase());
        }
    }
    region_from_locale(raw)
}

/// The country or region set in the system, as a two-letter code such as "BD". Windows reads Country or region;
/// macOS reads `AppleLocale`; Linux and the other Unix systems read the locale territory. The web view only reports
/// the display language, so an English system in Bangladesh looks like "en-US".
#[tauri::command]
fn device_region() -> Option<String> {
    #[cfg(windows)]
    {
        let mut buf = [0u16; 16];
        let n = unsafe { windows::Win32::Globalization::GetUserDefaultGeoName(&mut buf) };
        if n > 1 {
            let end = (n as usize - 1).min(buf.len());
            let s = String::from_utf16_lossy(&buf[..end]);
            // a two-letter country code (a three-digit region number is not one)
            if s.len() == 2 && s.chars().all(|c| c.is_ascii_alphabetic()) {
                return Some(s.to_uppercase());
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Some(region) = apple_region() {
            return Some(region);
        }
    }
    #[cfg(unix)]
    {
        if let Some(region) = locale_region() {
            return Some(region);
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // the window is created hidden (tauri.conf.json); show it only for the first loaded page, so a reload while it
    // sits in the tray (dev HMR, a crash recovery) does not pop it open
    #[cfg(desktop)]
    static SHOWN: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
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
        })
        // the window is created hidden (tauri.conf.json) so the saved size, place and maximized state are
        // applied before anyone sees it; it is shown once the page has loaded (not when started with --hidden)
        .on_page_load(|webview, payload| {
            if webview.label() == "main"
                && matches!(payload.event(), tauri::webview::PageLoadEvent::Finished)
                && !std::env::args().any(|a| a == "--hidden")
                && !SHOWN.swap(true, std::sync::atomic::Ordering::Relaxed)
            {
                let _ = webview.window().show();
            }
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
        .invoke_handler(tauri::generate_handler![media::media_state, open_inspector, device_region])
        .setup(|app| {
            build_tray(app)?;
            media::init(app);
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
