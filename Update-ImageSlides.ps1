<#
.SYNOPSIS
Auto-generates slides from local images in product-slides and extra-slides folders.
Run this script whenever you add or remove images from those folders.
#>

$BasePath = "D:\__GITHUB\_ct-MATRIX"
$Folders = @("product-slides", "extra-slides")
$OutFile = "$BasePath\local-images.json"

$OutData = @()

foreach ($folder in $Folders) {
    $path = Join-Path $BasePath $folder
    if (Test-Path $path) {
        $files = Get-ChildItem -Path $path -File -Include *.jpg,*.jpeg,*.png,*.gif,*.webp

        foreach ($file in $files) {
            $type = if ($folder -eq "product-slides") { "Product Promo" } else { "Extra Slide" }
            $color = if ($folder -eq "product-slides") { "#f97316" } else { "#10b981" }
            
            $OutData += @{
                id = [guid]::NewGuid().ToString()
                type = "PROMO"
                subType = $type
                title = $file.BaseName -replace '-', ' ' -replace '_', ' '
                description = "Automatically generated from $folder"
                bgImage = "$folder/$($file.Name)"
                highlightColor = $color
            }
        }
    }
}

$JsonContent = $OutData | ConvertTo-Json -Depth 5
Set-Content -Path $OutFile -Value $JsonContent -Encoding UTF8

Write-Host "Success! Found $($OutData.Count) images. Generated $OutFile."
Write-Host "Syncing exactly to GitHub so your changes apply everywhere..."

Set-Location -Path $BasePath
git add .
git commit -m "Auto-sync generated assets and data ($((Get-Date).ToString('yyyy-MM-dd HH:mm:ss')))"
git push

Write-Host "`nAll operations complete. Press any key to exit..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
