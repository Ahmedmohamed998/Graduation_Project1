# load_data.ps1
# ─────────────────────────────────────────────────────────────────────────────
# Imports all synthetic JSON files into MongoDB (hexaverse_test database).
#
# Prerequisites:
#   - MongoDB running locally (mongod) OR set $env:MONGO_URI
#   - mongoimport in PATH (comes with MongoDB Tools)
#   - Run synthetic_data_generator.py first to create data/*.json
#
# Usage:
#   cd d:\Graduation_Project\Hasibha\Graduation_Project1\grad_project_ai
#   .\analysis\load_data.ps1
# ─────────────────────────────────────────────────────────────────────────────

$DB  = "hexaverse_test"
$DIR = "$PSScriptRoot\..\data"
$URI = if ($env:MONGO_URI) { $env:MONGO_URI } else { "mongodb://localhost:27017" }

function Import-Collection {
    param($collection, $file)
    $path = "$DIR\$file"
    if (-not (Test-Path $path)) {
        Write-Host "  [WARN] File not found: $path" -ForegroundColor Yellow
        return
    }
    Write-Host "  [WAIT] Importing $collection from $file ..." -ForegroundColor Cyan
    mongoimport --uri "$URI/$DB" `
                --collection $collection `
                --file "$path" `
                --jsonArray `
                --drop `
                2>&1 | Select-String -Pattern "(imported|error)" | Write-Host
}

Write-Host "`n[INFO] Loading synthetic data into MongoDB ($DB)`n" -ForegroundColor Green

Import-Collection "users"         "users.json"
Import-Collection "transactions"  "transactions.json"
Import-Collection "voicefeedbacks" "voice_feedback.json"
Import-Collection "ocrfeedbacks"  "ocr_feedback.json"
Import-Collection "budgets"       "budgets.json"
Import-Collection "savingsgoals"  "savings_goals.json"
Import-Collection "debts"         "debts.json"

Write-Host "`n[DONE] Verifying counts...`n" -ForegroundColor Green

$collections = @("users","transactions","voicefeedbacks","ocrfeedbacks","budgets","savingsgoals","debts")
foreach ($col in $collections) {
    $count = mongosh $URI/$DB --quiet --eval "db.$col.countDocuments({})" 2>$null
    Write-Host "  $col : $count documents"
}

Write-Host "`n[INFO] MongoDB URI used: $URI/$DB`n"
