//! Playback controls outside the window.
//!
//! Windows: Previous, Play/Pause and Next buttons under the preview that opens when the pointer rests on the taskbar icon.
//! macOS and Linux: the system's media controls (Now Playing and the media keys on macOS, MPRIS on Linux, which the desktop
//! shows in its media panel and some taskbars).
//! The page tells this module what is playing (`media_state`); a press comes back to the page as the `media-control` event.

use tauri::AppHandle;

#[tauri::command]
pub fn media_state(app: AppHandle, playing: bool, title: String, artist: String) {
    #[cfg(windows)]
    thumb::set_state(&app, playing);
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    system::set_state(&app, playing, &title, &artist);
    let _ = (&app, playing, &title, &artist);
}

/// Called once from setup, after the main window exists.
pub fn init(app: &tauri::App) {
    #[cfg(windows)]
    thumb::install(app);
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    system::start(app.handle().clone());
    let _ = app;
}

#[cfg(windows)]
mod thumb {
    use std::cell::RefCell;
    use std::sync::{
        atomic::{AtomicBool, AtomicIsize, Ordering},
        Mutex, OnceLock,
    };
    use tauri::{AppHandle, Emitter, Manager};
    use windows::core::w;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::Graphics::Gdi::{CreateBitmap, DeleteObject};
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};
    use windows::Win32::UI::Shell::{
        DefSubclassProc, ITaskbarList3, SetWindowSubclass, TaskbarList, THB_FLAGS, THB_ICON, THB_TOOLTIP, THBF_ENABLED, THUMBBUTTON,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateIconIndirect, PostMessageW, RegisterWindowMessageW, HICON, ICONINFO, WM_APP, WM_COMMAND,
    };

    const THBN_CLICKED: usize = 0x1800;

    /// What the shell answered, for finding out why the buttons come and go (a small text file in the temp folder).
    fn note(text: &str) {
        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(std::env::temp_dir().join("quran-taskbar.log")) {
            let _ = writeln!(f, "{text}");
        }
    }
    const REFRESH: u32 = WM_APP + 41;
    const SIZE: usize = 32;
    const PREV: u32 = 0;
    const TOGGLE: u32 = 1;
    const NEXT: u32 = 2;

    static HWND_RAW: AtomicIsize = AtomicIsize::new(0);
    static PLAYING: AtomicBool = AtomicBool::new(false);
    static APP: Mutex<Option<AppHandle>> = Mutex::new(None);
    static CREATED: OnceLock<u32> = OnceLock::new();
    thread_local! {
        static LIST: RefCell<Option<ITaskbarList3>> = const { RefCell::new(None) };
        static ICONS: RefCell<Vec<HICON>> = const { RefCell::new(Vec::new()) };
    }

    /// A white glyph on a transparent 32 x 32 square: 0 previous, 1 play, 2 pause, 3 next.
    fn glyph(kind: u8) -> Vec<u32> {
        let mut px = vec![0u32; SIZE * SIZE];
        let white = 0xFFFF_FFFFu32;
        let tri = |px: &mut Vec<u32>, x0: f32, x1: f32, right: bool| {
            for y in 0..SIZE {
                for x in 0..SIZE {
                    let (fx, fy) = (x as f32 + 0.5, y as f32 + 0.5);
                    if fx < x0 || fx > x1 {
                        continue;
                    }
                    let t = if right { (fx - x0) / (x1 - x0) } else { (x1 - fx) / (x1 - x0) };
                    let half = 9.5 * (1.0 - t);
                    if (fy - 16.0).abs() <= half {
                        px[y * SIZE + x] = white;
                    }
                }
            }
        };
        let bar = |px: &mut Vec<u32>, x0: usize, x1: usize| {
            for y in 7..25 {
                for x in x0..x1 {
                    px[y * SIZE + x] = white;
                }
            }
        };
        match kind {
            0 => {
                bar(&mut px, 6, 9);
                tri(&mut px, 10.0, 26.0, false);
            }
            1 => tri(&mut px, 9.0, 25.0, true),
            2 => {
                bar(&mut px, 9, 14);
                bar(&mut px, 18, 23);
            }
            _ => {
                tri(&mut px, 6.0, 22.0, true);
                bar(&mut px, 23, 26);
            }
        }
        px
    }

    fn icon(kind: u8) -> HICON {
        unsafe {
            let colour = CreateBitmap(SIZE as i32, SIZE as i32, 1, 32, Some(glyph(kind).as_ptr() as *const _));
            let mask = CreateBitmap(SIZE as i32, SIZE as i32, 1, 1, Some(vec![0u8; SIZE * SIZE / 8].as_ptr() as *const _));
            let info = ICONINFO { fIcon: true.into(), xHotspot: 0, yHotspot: 0, hbmMask: mask, hbmColor: colour };
            let made = CreateIconIndirect(&info).unwrap_or_default();
            let _ = DeleteObject(colour.into());
            let _ = DeleteObject(mask.into());
            made
        }
    }

    fn tip(text: &str) -> [u16; 260] {
        let mut t = [0u16; 260];
        for (i, c) in text.encode_utf16().take(259).enumerate() {
            t[i] = c;
        }
        t
    }

    fn button(id: u32, icon: HICON, text: &str) -> THUMBBUTTON {
        THUMBBUTTON { dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS, iId: id, iBitmap: 0, hIcon: icon, szTip: tip(text), dwFlags: THBF_ENABLED }
    }

    fn buttons(playing: bool) -> [THUMBBUTTON; 3] {
        let icons = ICONS.with(|i| i.borrow().clone());
        [
            button(PREV, icons[0], "Previous surah"),
            button(TOGGLE, if playing { icons[2] } else { icons[1] }, if playing { "Pause" } else { "Play" }),
            button(NEXT, icons[3], "Next surah"),
        ]
    }

    /// On the window's own thread: add the three buttons (the taskbar button has just been created).
    unsafe fn add(hwnd: HWND) {
        unsafe {
            let list = match CoCreateInstance::<_, ITaskbarList3>(&TaskbarList, None, CLSCTX_INPROC_SERVER) {
                Ok(l) => l,
                Err(e) => return note(&format!("create: {e}")),
            };
            if let Err(e) = list.HrInit() {
                return note(&format!("init: {e}"));
            }
            ICONS.with(|i| {
                if i.borrow().is_empty() {
                    *i.borrow_mut() = (0..4).map(icon).collect();
                }
            });
            let result = list.ThumbBarAddButtons(hwnd, &buttons(PLAYING.load(Ordering::Relaxed)));
            note(&format!("add: {result:?}"));
            LIST.with(|l| *l.borrow_mut() = Some(list));
        }
    }

    /// Set all three buttons to match what is playing; if the shell has lost them, add them again.
    unsafe fn refresh(hwnd: HWND) {
        unsafe {
            if ICONS.with(|i| i.borrow().len()) < 4 {
                return add(hwnd);
            }
            let b = buttons(PLAYING.load(Ordering::Relaxed));
            let result = LIST.with(|l| l.borrow().as_ref().map(|list| list.ThumbBarUpdateButtons(hwnd, &b)));
            match result {
                Some(Ok(())) => {}
                other => {
                    note(&format!("update: {other:?}"));
                    add(hwnd);
                }
            }
        }
    }

    unsafe extern "system" fn proc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM, _id: usize, _data: usize) -> LRESULT {
        unsafe {
            if Some(&msg) == CREATED.get() {
                note("taskbar button created");
                add(hwnd);
            } else if msg == REFRESH {
                refresh(hwnd);
            } else if msg == WM_COMMAND && (wp.0 >> 16) == THBN_CLICKED {
                let name = match (wp.0 & 0xFFFF) as u32 {
                    PREV => "prev",
                    NEXT => "next",
                    _ => "toggle",
                };
                if let Some(app) = APP.lock().unwrap().as_ref() {
                    let _ = app.emit("media-control", name);
                }
            }
            DefSubclassProc(hwnd, msg, wp, lp)
        }
    }

    pub fn install(app: &tauri::App) {
        let Some(window) = app.get_webview_window("main") else { return };
        let Ok(h) = window.hwnd() else { return };
        *APP.lock().unwrap() = Some(app.handle().clone());
        HWND_RAW.store(h.0 as isize, Ordering::Relaxed);
        unsafe {
            let _ = CREATED.set(RegisterWindowMessageW(w!("TaskbarButtonCreated")));
            let _ = SetWindowSubclass(HWND(h.0 as _), Some(proc), 41, 0);
        }
        // the shell may drop the buttons (a hidden window, a restarted Explorer): check them every few seconds
        std::thread::spawn(|| loop {
            std::thread::sleep(std::time::Duration::from_secs(3));
            let raw = HWND_RAW.load(Ordering::Relaxed);
            unsafe {
                let _ = PostMessageW(Some(HWND(raw as _)), REFRESH, WPARAM(0), LPARAM(0));
            }
        });
    }

    pub fn set_state(_app: &AppHandle, playing: bool) {
        note(&format!("state: playing={playing}"));
        PLAYING.store(playing, Ordering::Relaxed);
        let raw = HWND_RAW.load(Ordering::Relaxed);
        if raw != 0 {
            // the buttons belong to the window's thread: ask it to redraw the middle one
            unsafe {
                let _ = PostMessageW(Some(HWND(raw as _)), REFRESH, WPARAM(0), LPARAM(0));
            }
        }
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
mod system {
    use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, PlatformConfig};
    use std::sync::{mpsc, Mutex};
    use tauri::{AppHandle, Emitter};

    enum Msg {
        State { playing: bool, title: String, artist: String },
    }
    static TX: Mutex<Option<mpsc::Sender<Msg>>> = Mutex::new(None);

    /// The controls live on a thread of their own, so nothing here has to be Send.
    pub fn start(app: AppHandle) {
        let (tx, rx) = mpsc::channel::<Msg>();
        *TX.lock().unwrap() = Some(tx);
        std::thread::spawn(move || {
            let config = PlatformConfig { dbus_name: "quran_desktop", display_name: "Quran", hwnd: None };
            let Ok(mut controls) = MediaControls::new(config) else { return };
            let handle = app.clone();
            let _ = controls.attach(move |event| {
                let name = match event {
                    MediaControlEvent::Play => "play",
                    MediaControlEvent::Pause => "pause",
                    MediaControlEvent::Toggle => "toggle",
                    MediaControlEvent::Next => "next",
                    MediaControlEvent::Previous => "prev",
                    _ => return,
                };
                let _ = handle.emit("media-control", name);
            });
            while let Ok(Msg::State { playing, title, artist }) = rx.recv() {
                let _ = controls.set_metadata(MediaMetadata { title: Some(&title), artist: Some(&artist), album: Some("Quran"), ..Default::default() });
                let _ = controls.set_playback(if playing { MediaPlayback::Playing { progress: None } } else { MediaPlayback::Paused { progress: None } });
            }
        });
    }

    pub fn set_state(_app: &AppHandle, playing: bool, title: &str, artist: &str) {
        if let Some(tx) = TX.lock().unwrap().as_ref() {
            let _ = tx.send(Msg::State { playing, title: title.into(), artist: artist.into() });
        }
    }
}
