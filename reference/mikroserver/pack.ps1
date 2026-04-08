Add-Type -Assembly System.IO.Compression.FileSystem

$src = 'C:\Users\PC\OneDrive - Epitech\amy\PROJETS-TERMINES\mikroserver'
$dst = 'C:\Users\PC\OneDrive - Epitech\mikroserver-deploy.zip'

if (Test-Path $dst) { Remove-Item $dst -Force }

$exclude = 'node_modules|[/\\]\.next[/\\]|[/\\]dist[/\\]|[/\\]\.git[/\\]|\.next\\trace'

$files = Get-ChildItem -Path $src -Recurse -File | Where-Object {
    $_.FullName -notmatch $exclude
}

Write-Host "Compression de $($files.Count) fichiers..."

$archive = [System.IO.Compression.ZipFile]::Open($dst, 'Create')

foreach ($file in $files) {
    $entryName = $file.FullName.Substring($src.Length + 1).Replace('\', '/')
    try {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName) | Out-Null
    } catch {
        Write-Host "Skip: $entryName"
    }
}

$archive.Dispose()

$size = [math]::Round((Get-Item $dst).Length / 1MB, 1)
Write-Host "Termine: $dst ($size MB)"
