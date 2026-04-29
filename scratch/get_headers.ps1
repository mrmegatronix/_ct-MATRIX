$url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTjplY4qgdlDPmFO4sKUoWHnBPoeqf-rY3Tc0Y50wgDbDutbTn4j_hXhW3aXhYVjvfbIlwcIOF07250/pub?gid=1948723750&single=true&output=csv'
$response = Invoke-WebRequest -Uri $url
$content = $response.Content
$lines = $content -split "`r`n"
if ($lines.Count -eq 0) { $lines = $content -split "`n" }
Write-Host $lines[0]
