<#
.SYNOPSIS
A completely independent Git Syncing script.
Run this script to forcefully push any and all matrix local changes (HTML/CSS/JS file edits, configs) safely to GitHub.
#>

$BasePath = "D:\__GITHUB\_ct-MATRIX"
Set-Location -Path $BasePath

Write-Host "========================================="
Write-Host "      SYSTEM GITHUB AUTO-SYNC TOOL       "
Write-Host "========================================="
Write-Host "Syncing all files..."

git add .
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No new changes detected."
} else {
    git commit -m "Auto-saved environment update ($((Get-Date).ToString('yyyy-MM-dd HH:mm:ss')))"
    git push
    Write-Host "Changes pushed to GitHub successfully."
}

Write-Host "`nAll operations complete! Press any key to exit..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
