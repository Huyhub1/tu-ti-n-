@echo off
rem ============================================================
rem  TU TIEN DISCORD BOT - khoi dong bang cach bam doi vao day.
rem
rem  File nay chay `npm start`, tuc la chay qua tien trinh giam
rem  sat (scripts/supervisor.js): bot tu bat lai khi sap, va tu
rem  len ban moi khi co commit moi tren git.
rem
rem  Muon chay thang bot khong giam sat: npm run start:bot
rem ============================================================

rem Bang ma UTF-8, khong co dong nay thi log tieng Viet ra rac.
chcp 65001 >nul

rem Chay tu dung thu muc chua file nay, bam doi tu dau cung dung.
cd /d "%~dp0"

echo ============================================================
echo   TU TIEN DISCORD BOT
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Khong tim thay Node.js.
  echo     Tai ve o https://nodejs.org roi cai, sau do mo lai file nay.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [!] Chua co file .env
  echo     Chep .env.example thanh .env roi dien token that vao.
  echo.
  echo     copy .env.example .env
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [*] Chua co node_modules - dang cai thu vien, cho mot lat...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] Cai thu vien that bai. Xem loi phia tren.
    pause
    exit /b 1
  )
  echo.
)

call npm start

echo.
echo ============================================================
echo   Bot da dung. Bam phim bat ky de dong cua so.
echo ============================================================
pause
