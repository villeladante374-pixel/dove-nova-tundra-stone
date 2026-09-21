@echo off
set DEST=%LOCALAPPDATA%\BookClub
mkdir "%DEST%" >nul 2>&1
xcopy /E /I /Y "%~dp0*" "%DEST%\" >nul
powershell -NoProfile -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Book Club.lnk'); $s.TargetPath='%DEST%\Book Club.exe'; $s.WorkingDirectory='%DEST%'; $s.IconLocation='%DEST%\Book Club.exe'; $s.Save()"
start "" "%DEST%\Book Club.exe"
