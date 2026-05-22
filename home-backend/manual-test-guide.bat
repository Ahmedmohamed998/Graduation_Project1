@echo off
echo ================================================
echo Complete New User Testing - Home Backend
echo ================================================
echo.

REM Configuration
set AUTH_URL=http://localhost:3210
set HOME_URL=http://localhost:5001

echo [Step 1] Checking if servers are running...
curl -s %HOME_URL%/health > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Home backend is not running on port 5001
    echo Please start it with: npm run dev
    pause
    exit /b 1
)
echo OK - Home backend is running

curl -s %AUTH_URL%/ > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Auth backend is not running on port 3210
    echo Please start it with: npm run dev
    pause
    exit /b 1
)
echo OK - Auth backend is running
echo.

echo ================================================
echo MANUAL TESTING GUIDE - New User Flow
echo ================================================
echo.
echo Please run these commands in order using curl or Postman:
echo.
echo === STEP 1: SIGNUP ===
echo curl -X POST %AUTH_URL%/api/auth/signup ^
echo   -H "Content-Type: application/json" ^
echo   -d "{\"email\":\"newuser@test.com\",\"password\":\"Test123456\",\"phone\":\"+201234567890\"}"
echo.
echo === STEP 2: LOGIN ===
echo curl -X POST %AUTH_URL%/api/auth/login ^
echo   -H "Content-Type: application/json" ^
echo   -d "{\"email\":\"newuser@test.com\",\"password\":\"Test123456\"}"
echo.
echo (Copy the accessToken from the response)
echo.
echo === STEP 3: DASHBOARD ===
echo curl -X GET %HOME_URL%/api/dashboard ^
echo   -H "Authorization: Bearer YOUR_TOKEN_HERE"
echo.
echo === STEP 4: UPDATE PROFILE ===
echo curl -X PUT %HOME_URL%/api/profile ^
echo   -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
echo   -H "Content-Type: application/json" ^
echo   -d "{\"displayName\":\"Mohamed Yaser\",\"currency\":\"EGP\"}"
echo.
echo === STEP 5: ADD INCOME ===
echo curl -X POST %HOME_URL%/api/transactions ^
echo   -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
echo   -H "Content-Type: application/json" ^
echo   -d "{\"type\":\"income\",\"amount\":8500,\"category\":\"Salary\",\"description\":\"Monthly salary\"}"
echo.
echo === STEP 6: ADD EXPENSE ===
echo curl -X POST %HOME_URL%/api/transactions ^
echo   -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
echo   -H "Content-Type: application/json" ^
echo   -d "{\"type\":\"expense\",\"amount\":150.50,\"category\":\"Food & Dining\",\"description\":\"Groceries\"}"
echo.
echo === STEP 7: VIEW UPDATED DASHBOARD ===
echo curl -X GET %HOME_URL%/api/dashboard ^
echo   -H "Authorization: Bearer YOUR_TOKEN_HERE"
echo.
echo === STEP 8: CREATE BUDGET ===
echo curl -X POST %HOME_URL%/api/budgets ^
echo   -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
echo   -H "Content-Type: application/json" ^
echo   -d "{\"name\":\"Food Budget\",\"category\":\"Food & Dining\",\"limitAmount\":2000,\"period\":\"monthly\",\"startDate\":\"2026-01-01\",\"endDate\":\"2026-01-31\"}"
echo.
echo === STEP 9: CREATE SAVINGS GOAL ===
echo curl -X POST %HOME_URL%/api/savings ^
echo   -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
echo   -H "Content-Type: application/json" ^
echo   -d "{\"name\":\"Vacation Fund\",\"targetAmount\":5000,\"deadline\":\"2026-07-01\",\"priority\":\"high\"}"
echo.
echo === STEP 10: VIEW ANALYTICS ===
echo curl -X GET "%HOME_URL%/api/analytics/overview?period=monthly" ^
echo   -H "Authorization: Bearer YOUR_TOKEN_HERE"
echo.
echo ================================================
echo All servers are ready for testing!
echo ================================================
pause
