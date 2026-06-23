$files = Get-ChildItem songs -Recurse | Where-Object { @('.mp3','.wav','.m4a','.flac') -contains $_.Extension } | Sort-Object FullName
Write-Host ("TOTAL: " + $files.Count)
$files | ForEach-Object { $_.FullName.Replace((Get-Location).Path + '\', '') }
