# PowerShell script to help transfer environment variables from web3aistore to omniagenthub_app
# Step 1: Pull environment variables from the old project

Write-Host "Step 1: Pulling environment variables from web3aistore project..." -ForegroundColor Cyan

# Try to pull from web3aistore project
# Note: This requires you to be authenticated with Vercel CLI (run 'vercel login' if needed)

$oldProjectName = "web3aistore"
$newProjectName = "omniagenthub_app"

Write-Host "`nAttempting to pull environment variables from $oldProjectName..." -ForegroundColor Yellow

# Create a temporary directory for the old project
$tempDir = Join-Path $env:TEMP "vercel_env_transfer"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# Pull env vars from the old project
Write-Host "`nPulling production environment variables from $oldProjectName..." -ForegroundColor Green
vercel env pull "$tempDir\.env.production" --environment=production --cwd $tempDir --yes

if (Test-Path "$tempDir\.env.production") {
    Write-Host "`nSuccessfully pulled environment variables!" -ForegroundColor Green
    Write-Host "`nEnvironment variables saved to: $tempDir\.env.production" -ForegroundColor Cyan
    
    # Show the file content (masked)
    Write-Host "`n--- Environment Variables (values masked) ---" -ForegroundColor Yellow
    Get-Content "$tempDir\.env.production" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.+)$") {
            $key = $matches[1]
            Write-Host "$key=********"
        }
    }
    
    Write-Host "`n`nTo add these to $newProjectName, run:" -ForegroundColor Cyan
    Write-Host "cd d:\Projects\omniagenthub_app" -ForegroundColor White
    Write-Host "Get-Content '$tempDir\.env.production' | ForEach-Object {" -ForegroundColor White
    Write-Host "    if (`$_ -match '^([^=]+)=(.+)`$') {" -ForegroundColor White
    Write-Host "        `$key = `$matches[1]; `$value = `$matches[2]" -ForegroundColor White
    Write-Host "        vercel env add `$key production --force <<< `$value" -ForegroundColor White
    Write-Host "    }" -ForegroundColor White
    Write-Host "}" -ForegroundColor White
} else {
    Write-Host "`nFailed to pull environment variables." -ForegroundColor Red
    Write-Host "You may need to:" -ForegroundColor Yellow
    Write-Host "1. Run 'vercel login' to authenticate" -ForegroundColor White
    Write-Host "2. Ensure you have access to the $oldProjectName project" -ForegroundColor White
    Write-Host "3. Manually copy from Vercel dashboard" -ForegroundColor White
}

Write-Host "`n`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
