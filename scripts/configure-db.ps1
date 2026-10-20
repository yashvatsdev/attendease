$ErrorActionPreference = 'Stop'
$target = Join-Path (Split-Path $PSScriptRoot) '.env.local'
if (Test-Path -LiteralPath $target) { throw '.env.local already exists. Edit it locally to update credentials.' }
$dbHostValue = Read-Host 'MySQL host (Enter for 127.0.0.1)'
if (!$dbHostValue) { $dbHostValue = '127.0.0.1' }
$dbUserValue = Read-Host 'MySQL user'
$secretValue = Read-Host 'MySQL password (hidden)' -AsSecureString
$pointerValue = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretValue)
try {
  $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointerValue)
  $lines = @(
    ('DB_HOST=' + ($dbHostValue | ConvertTo-Json -Compress))
    'DB_PORT=3306'
    ('DB_USER=' + ($dbUserValue | ConvertTo-Json -Compress))
    ('DB_PASSWORD=' + ($plainValue | ConvertTo-Json -Compress))
    'DB_NAME=attendease'
  )
  [IO.File]::WriteAllLines($target, $lines, [Text.UTF8Encoding]::new($false))
  Write-Host 'Saved credentials locally. Run npm.cmd run db:setup and npm.cmd run db:seed.'
} finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointerValue); $plainValue = $null }
