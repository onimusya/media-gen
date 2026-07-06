@echo off
REM Install media-gen-cli (Windows CMD)
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%\..\..\..\"
set "PROJECT_DIR=%CD%"
popd

echo Installing media-gen-cli from: %PROJECT_DIR%

cd /d "%PROJECT_DIR%"

REM Check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is required but not installed.
    echo Install it from https://nodejs.org/ ^(v18+^)
    exit /b 1
)

REM Install dependencies
echo Installing dependencies...
call npm install --silent
if %ERRORLEVEL% neq 0 exit /b 1

REM Build the CLI
echo Building CLI...
call npm run build --silent
if %ERRORLEVEL% neq 0 exit /b 1

REM Verify
if exist "%PROJECT_DIR%\dist\media-gen.mjs" (
    echo.
    echo [OK] media-gen-cli installed successfully!
    echo.
    echo Run with:
    echo   node %PROJECT_DIR%\dist\media-gen.mjs --help
    echo.
    echo Or link globally:
    echo   npm link
    echo   media-gen --help
) else (
    echo Error: Build failed. dist\media-gen.mjs not found.
    exit /b 1
)
