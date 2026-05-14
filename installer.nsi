; WashControl Installer - Dark Theme
!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "WashControl"
OutFile "washcontrol_installer.exe"
InstallDir "$PROGRAMFILES\WashControl"
RequestExecutionLevel admin

; Dark theme colors
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "installer\logo_header.bmp"
!define MUI_ICON "installer\app_icon.ico"
!define MUI_UNICON "installer\app_icon.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "Russian"

Section "WashControl (Required)" SecMain
  SetOutPath $INSTDIR
  
  ; Copy main files
  File "build\washcontrol_portable\washcontrol.exe"
  File "build\washcontrol_portable\ЗАПУСТИТЬ.bat"
  File /r "build\washcontrol_portable\data"
  File /r "build\washcontrol_portable\frontend"
  
  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\WashControl"
  CreateShortCut "$SMPROGRAMS\WashControl\WashControl.lnk" "$INSTDIR\washcontrol.exe"
  CreateShortCut "$DESKTOP\WashControl.lnk" "$INSTDIR\washcontrol.exe"
  
  ; Add to PATH (optional)
  WriteRegStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "WashControl" "$INSTDIR"
  
  ; Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Auto-start on Windows startup" SecAutoStart
  CreateShortCut "$APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\WashControl.lnk" "$INSTDIR\washcontrol.exe"
SectionEnd

Section "Desktop Shortcut" SecDesktop
  CreateShortCut "$DESKTOP\WashControl.lnk" "$INSTDIR\washcontrol.exe"
SectionEnd

Section -Post
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WashControl" "DisplayName" "WashControl"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WashControl" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WashControl" "DisplayIcon" "$INSTDIR\washcontrol.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WashControl" "Publisher" "WashControl Team"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WashControl" "DisplayVersion" "1.0.0"
SectionEnd

Section "Uninstall"
  ; Remove files
  Delete "$INSTDIR\washcontrol.exe"
  Delete "$INSTDIR\ЗАПУСТИТЬ.bat"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR\data"
  RMDir /r "$INSTDIR\frontend"
  RMDir "$INSTDIR"
  
  ; Remove shortcuts
  Delete "$SMPROGRAMS\WashControl\WashControl.lnk"
  RMDir "$SMPROGRAMS\WashControl"
  Delete "$DESKTOP\WashControl.lnk"
  Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\WashControl.lnk"
  
  ; Remove registry
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\WashControl"
  DeleteRegValue HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "WashControl"
SectionEnd
