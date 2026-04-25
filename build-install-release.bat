@echo off
setlocal

echo ================================
echo SKRPlayer Release Build and Install
echo ================================

cd /d "%~dp0android"

echo Checking connected devices...
adb devices
if errorlevel 1 goto failed

echo Building release APK...
call gradlew.bat assembleRelease
if errorlevel 1 goto failed

echo Installing Release APK to device...
adb install -r app\build\outputs\apk\release\app-release.apk
if errorlevel 1 goto failed

echo Launching SKRPlayer...
adb shell monkey -p com.skrplayer -c android.intent.category.LAUNCHER 1
if errorlevel 1 goto failed

echo ================================
echo Release Version Installed successfully.
echo ================================
pause
exit /b 0

:failed
echo Build or install failed.
pause
exit /b 1
