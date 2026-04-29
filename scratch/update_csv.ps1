$filePath = 'D:\__GITHUB\_ct-MATRIX\master-csv-backup.csv'
$content = Get-Content $filePath
$header = "Date,Day,Event Type,Event Name,Details,Time / Price,Location,Slide Footer,Slide Type,Hidden Notes,Accent Hex Colour,Countdown Finish,Feature QR,Footer QR,Footer Hyperlink,Slide Duration,Slide Background,Foreground Image,Bubble Text,Lock Slide,Lock Day,Lock Time,Transition,Zoom"

$newContent = New-Object System.Collections.Generic.List[string]
$newContent.Add($header)

for ($i = 1; $i -lt $content.Count; $i++) {
    $line = $content[$i]
    if (-not [string]::IsNullOrWhiteSpace($line)) {
        $newContent.Add($line + ",,")
    }
}

$newContent | Set-Content $filePath
