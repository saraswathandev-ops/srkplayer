@echo off
setlocal

echo ================================
echo SKRPlayer Debug APK Build
echo ================================

cd /d "%~dp0android"

echo Cleaning project...
call gradlew.bat clean
if errorlevel 1 goto failed

echo Building debug APK...
call gradlew.bat assembleDebug
if errorlevel 1 goto failed

echo ================================
echo APK generated successfully.
echo Path:
echo %~dp0android\app\build\outputs\apk\debug\app-debug.apk
echo ================================
pause
exit /b 0

:failed
echo Build failed.
pause
exit /b 1
