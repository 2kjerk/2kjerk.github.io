@echo off

echo ===============================
echo scheduled upload
echo ===============================
echo.

set "SITE_DIR=%~dp0"

echo folder:
echo %SITE_DIR%
echo.

set /p REPO="github repo url (.git): "

echo.
echo schedule upload:
echo.

set /p RELEASE_DATE="date (m/d/yyyy): "
set /p RELEASE_TIME="time (example 6:00 pm): "

for /f "delims=" %%A in ('powershell -command "\"%RELEASE_TIME%\".ToUpper()"') do set RELEASE_TIME=%%A

echo.
echo scheduled:
echo %RELEASE_DATE% at %RELEASE_TIME%
echo.

echo waiting...
echo press ctrl+c to cancel.
echo.


:WAIT_LOOP

for /f "delims=" %%A in ('powershell -command "Get-Date -Format 'M/d/yyyy h:mm tt'"') do set CURRENT=%%A

echo current time: %CURRENT%

for /f "tokens=1,* delims= " %%A in ("%CURRENT%") do (
    set CURRENT_DATE=%%A
    set CURRENT_TIME=%%B
)

if "%CURRENT_DATE%"=="%RELEASE_DATE%" (
    if /i "%CURRENT_TIME%"=="%RELEASE_TIME%" goto UPLOAD
)

timeout /t 10 >nul
goto WAIT_LOOP


:UPLOAD

echo.
echo ===============================
echo uploading...
echo ===============================
echo.

cd /d "%SITE_DIR%"

if not exist ".git" (
    git init
)

git branch -M master

git remote remove origin >nul 2>&1
git remote add origin %REPO%

git add .

git commit -m "scheduled upload"

git push origin master --force

if %errorlevel%==0 (
    echo.
    echo upload complete.
) else (
    echo.
    echo upload failed.
)

pause