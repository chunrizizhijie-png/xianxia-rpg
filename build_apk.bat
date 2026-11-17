@echo off
chcp 65001 >nul
echo ========================================================
echo   《玄霄问道录 · 九州万法沙盒版》Android APK 一键打包脚本
echo ========================================================
cd /d "%~dp0android"
if exist gradlew.bat (
    call gradlew.bat assembleDebug
) else (
    gradle assembleDebug
)
echo.
echo [完成] APK 安装包已生成至:
echo android\app\build\outputs\apk\debug\app-debug.apk
pause
