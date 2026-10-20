$ErrorActionPreference = 'Stop'
$projectRootValue = Split-Path $PSScriptRoot
$secretDirValue = Join-Path $projectRootValue '.secrets'
$targetValue = Join-Path $secretDirValue 'cloud-db.json'
if (Test-Path -LiteralPath $targetValue) { throw 'Cloud credentials already exist. Edit .secrets/cloud-db.json locally if you need to change them.' }
$dbHostValue = Read-Host 'Aiven MySQL hostname (without https://)'
if (!$dbHostValue -or $dbHostValue -match '[:/\s]' -or $dbHostValue -in @('localhost', '127.0.0.1')) { throw 'Enter the hosted MySQL hostname from Aiven Overview.' }
$portInputValue = Read-Host 'MySQL port from Aiven Overview'
$dbPortValue = 0
if (![int]::TryParse($portInputValue, [ref]$dbPortValue) -or $dbPortValue -lt 1 -or $dbPortValue -gt 65535) { throw 'Enter a valid port number.' }
$dbUserValue = Read-Host 'MySQL user (Enter for avnadmin)'
if (!$dbUserValue) { $dbUserValue = 'avnadmin' }
$secretValue = Read-Host 'Aiven MySQL password (hidden)' -AsSecureString
$caPathValue = Read-Host 'Full path to downloaded Aiven CA certificate (ca.pem)'
$caTextValue = [IO.File]::ReadAllText($caPathValue.Trim('"'))
if ($caTextValue -notmatch '-----BEGIN CERTIFICATE-----') { throw 'The file must contain the Aiven PEM CA certificate.' }
$pointerValue = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretValue)
try {
  $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointerValue)
  $configValue = [ordered]@{ DB_HOST=$dbHostValue; DB_PORT=[string]$dbPortValue; DB_USER=$dbUserValue; DB_PASSWORD=$plainValue; DB_NAME='attendease'; DB_SSL='true'; DB_SSL_CA=$caTextValue }
  [IO.Directory]::CreateDirectory($secretDirValue) | Out-Null
  [IO.File]::WriteAllText($targetValue, ($configValue | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
  Write-Host 'Saved cloud credentials privately in .secrets/cloud-db.json. Local MySQL settings are unchanged.'
  Write-Host 'Run npm.cmd run db:cloud:setup, npm.cmd run db:cloud:seed, and npm.cmd run db:cloud:check.'
} finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointerValue); $plainValue=$null; $configValue=$null }
