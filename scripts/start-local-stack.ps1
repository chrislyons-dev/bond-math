# Open a new PowerShell window and run: cd ui; npm run dev
$PS_EXE = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

# 1. Day-Count (no dependencies)
Start-Process $PS_EXE `
  -ArgumentList '-NoExit','-Command','$Host.UI.RawUI.WindowTitle = ''Daycnt''; cd ..\services\daycount; $Host.UI.RawUI.ForegroundColor = ''Blue''; $Host.UI.RawUI.BackgroundColor = ''DarkYellow''; npm run dev' `
  -WorkingDirectory (Split-Path -Parent $PSCommandPath) `
  -WindowStyle Normal

# 2. Bond Valuation (depends on Day-Count)
Start-Process $PS_EXE `
  -ArgumentList '-NoExit','-Command','$Host.UI.RawUI.WindowTitle = ''Bondval''; cd ..\services\bond-valuation; $Host.UI.RawUI.ForegroundColor = ''Magenta''; $Host.UI.RawUI.BackgroundColor = ''DarkYellow''; wrangler dev --config ..\..\iac\workers\valuation.toml --port 8788' `
  -WorkingDirectory (Split-Path -Parent $PSCommandPath) `
  -WindowStyle Normal

# 3. Metrics (depends on Valuation & Day-Count)
Start-Process $PS_EXE `
  -ArgumentList '-NoExit','-Command','$Host.UI.RawUI.WindowTitle = ''Metrics''; cd ..\services\metrics; $Host.UI.RawUI.ForegroundColor = ''Yellow''; $Host.UI.RawUI.BackgroundColor = ''Blue''; wrangler dev --config ..\..\iac\workers\metrics.toml --port 8789' `
  -WorkingDirectory (Split-Path -Parent $PSCommandPath) `
  -WindowStyle Normal

# 4. Pricing (no dependencies)
Start-Process $PS_EXE `
  -ArgumentList '-NoExit','-Command','$Host.UI.RawUI.WindowTitle = ''Pricing''; cd ..\services\pricing; $Host.UI.RawUI.ForegroundColor = ''DarkYellow''; $Host.UI.RawUI.BackgroundColor = ''Blue''; wrangler dev --config ..\..\iac\workers\pricing.toml --port 8790' `
  -WorkingDirectory (Split-Path -Parent $PSCommandPath) `
  -WindowStyle Normal

# 5. Gateway (depends on all services)
Start-Process $PS_EXE `
  -ArgumentList '-NoExit','-Command','$Host.UI.RawUI.WindowTitle = ''Gateway''; cd ..\services\gateway; $Host.UI.RawUI.ForegroundColor = ''Green''; $Host.UI.RawUI.BackgroundColor = ''DarkYellow''; npm run dev -- --port 8791' `
  -WorkingDirectory (Split-Path -Parent $PSCommandPath) `
  -WindowStyle Normal

# 6. UI
Start-Process $PS_EXE `
  -ArgumentList '-NoExit','-Command','$Host.UI.RawUI.WindowTitle = ''UI''; cd ..\ui; $Host.UI.RawUI.ForegroundColor = ''Cyan''; $Host.UI.RawUI.BackgroundColor = ''DarkGray''; npm run dev' `
  -WorkingDirectory (Split-Path -Parent $PSCommandPath) `
  -WindowStyle Normal

Write-Host "Day Count is running on      port 8787"
Write-Host "Bond Valuation is running on port 8788"
Write-Host "Pricing is running on        port 8789"
Write-Host "Metrics is running on        port 8790"
Write-Host "Gateway is running on        port 8791"
Write-Host "UI is running on             port 4321"
