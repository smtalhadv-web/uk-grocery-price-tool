@echo off
REM Daily price refresh for the retailers GitHub's runners cannot reach.
REM
REM Point Windows Task Scheduler at this file. Set "Start in" to the repo
REM folder, or it will not find package.json.
REM
REM   Program/script:  C:\path\to\repo\scripts\refresh-local.cmd
REM   Start in:        C:\path\to\repo
REM
REM Output is appended to refresh-local.log in the repo folder, so a failed
REM night can be read the next morning.

cd /d "%~dp0.."

echo. >> refresh-local.log
echo ===== %DATE% %TIME% ===== >> refresh-local.log

call npm run refresh:local >> refresh-local.log 2>&1

if errorlevel 1 (
  echo Refresh finished with errors - see refresh-local.log >> refresh-local.log
  exit /b 1
)

echo Refresh completed. >> refresh-local.log
exit /b 0
