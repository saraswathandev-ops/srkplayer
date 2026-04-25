@echo off
setlocal

echo ================================
echo SKRPlayer Release APK Build
echo ================================

cd /d "%~dp0android"

echo Cleaning project...
call gradlew.bat clean
if errorlevel 1 goto failed

echo Building release APK...
call gradlew.bat assembleRelease
if errorlevel 1 goto failed

echo ================================
echo Release APK generated successfully.
echo Path:
echo %~dp0android\app\build\outputs\apk\release\app-release.apk
echo ================================
pause
exit /b 0

:failed
echo Release build failed.
pause
exit /b 1
