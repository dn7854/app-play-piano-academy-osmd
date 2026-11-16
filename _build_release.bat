@echo off
set "PATH=C:\Program Files\Git\usr\bin;C:\Program Files\Git\bin;%PATH%"
cd /d "C:\Coding\app-play-piano-academy-osmd\android"
call gradlew.bat assembleRelease --console=plain > "C:\Coding\app-play-piano-academy-osmd\build-release.log" 2>&1