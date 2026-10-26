; Installer hooks for the Windows (NSIS) installer.
; Tauri calls these at fixed points; see https://v2.tauri.app/distribute/windows-installer/

!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove everything the app wrote after install: the webview profile (settings and the
  ; offline audio library), the config folder and logs. Skipped during an in-place update,
  ; so updating never costs anyone their downloaded surahs.
  ${If} $UpdateMode <> 1
    SetShellVarContext current
    RMDir /r "$LOCALAPPDATA\${BUNDLEID}"
    RMDir /r "$APPDATA\${BUNDLEID}"
  ${EndIf}
!macroend
