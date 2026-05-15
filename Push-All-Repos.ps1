# Push-All-Repos.ps1
# Syncs all Coasters Tavern repositories in the GITHUB folder

$basePath = "D:\__GITHUB"
$repos = Get-ChildItem -Path $basePath -Directory | Where-Object { Test-Path "$($_.FullName)\.git" }

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "Auto-sync: Matrix System Finalization ($timestamp)"

foreach ($repo in $repos) {
    Write-Host "-----------------------------------------"
    Write-Host "Syncing Repo: $($repo.Name)"
    Set-Location -Path $repo.FullName
    
    # 1. Pull latest
    Write-Host "Pulling..."
    git pull --rebase
    
    # 2. Check for changes
    $status = git status --porcelain
    if ($null -eq $status -or $status -eq "") {
        Write-Host "No local changes to push."
    } else {
        Write-Host "Changes detected. Committing and pushing..."
        git add .
        git commit -m $commitMessage
        git push
        Write-Host "Sync complete for $($repo.Name)"
    }
}

Write-Host "========================================="
Write-Host "ALL REPOS SYNCED SUCCESSFULLY"
Write-Host "========================================="
