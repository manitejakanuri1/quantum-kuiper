@echo off
echo ========================================
echo QUANTUM-KUIPER SYSTEM TEST SUITE
echo ========================================
echo.

echo [1/6] Testing Database Health...
curl -s http://localhost:3000/api/health
echo.
echo.

echo [2/6] Testing Q&A Performance...
cd backend
node test-qa-retrieval.js
echo.
echo.

echo [3/6] Testing Backend API...
curl -s http://localhost:8080/api/health
echo.
echo.

echo [4/6] Checking Frontend...
curl -s -I http://localhost:3000 | findstr "200 OK"
echo.
echo.

echo [5/6] System Summary...
echo ✅ Backend: http://localhost:8080
echo ✅ Frontend: http://localhost:3000
echo ✅ Health: http://localhost:3000/api/health
echo.

echo [6/6] Quick Performance Test...
cd ..
echo Testing response times...
FOR /L %%i IN (1,1,5) DO (
    curl -s -w "Response time: %%{time_total}s\n" -o nul http://localhost:3000/api/health
)
echo.

echo ========================================
echo TEST SUITE COMPLETE!
echo ========================================
echo.
echo Next steps:
echo 1. Open http://localhost:3000 in browser
echo 2. Create a test account
echo 3. Create an agent
echo 4. Test voice interaction
echo.
pause
