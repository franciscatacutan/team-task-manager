#requires -Version 7.2
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('Init','Validate','Start','Stop','Status','ExportCa','Check','Backup','Restore')][string]$Action,
  [ValidatePattern('^[a-z][a-z0-9-]{0,30}$')][string]$Name = 'rehearsal',
  [ValidateSet('Dev','Rehearsal','Lan')][string]$Mode = 'Rehearsal',
  [string]$HostAddress = 'localhost',
  [ValidateRange(1024,65535)][int]$Port = 8443,
  [ValidateRange(1024,65535)][int]$BackendPort = 18080,
  [ValidateRange(1024,65535)][int]$FrontendPort = 5173,
  [ValidateRange(1024,65535)][int]$DatabasePort = 15433,
  [ValidatePattern('^[a-zA-Z0-9_.-]+\.dump$')][string]$Archive,
  [ValidatePattern('^restore_[a-z0-9_]{1,40}$')][string]$TargetDatabase,
  [switch]$NoBuild
)
$ErrorActionPreference = 'Stop'
$state = Join-Path $PSScriptRoot "state/$Name"
$environmentFile = Join-Path $state 'environment.env'

function New-LocalSecret {
  return [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
}

if ($Action -eq 'Init') {
  if (Test-Path -LiteralPath $environmentFile) { throw 'Environment exists. Reuse it; initialization never rotates existing credentials.' }
  if ($Mode -eq 'Lan') {
    $address = [Net.IPAddress]::Parse($HostAddress)
    $bytes = $address.GetAddressBytes()
    $privateV4 = $address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork -and (
      $bytes[0] -eq 10 -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
      ($bytes[0] -eq 192 -and $bytes[1] -eq 168))
    if (!$privateV4) { throw 'LAN mode requires your private IPv4 address (10.x, 172.16–31.x or 192.168.x).' }
    $binding = $HostAddress
  } else {
    if ($HostAddress -ne 'localhost') { throw 'Use localhost for Dev/Rehearsal; use Lan for a private IPv4 address.' }
    $binding = '127.0.0.1'
  }
  $profile = if ($Mode -eq 'Dev') { 'local' } else { 'prod' }
  $origin = if ($Mode -eq 'Dev') { "http://localhost:$FrontendPort" } else { "https://${HostAddress}:$Port" }
  New-Item -ItemType Directory -Path (Join-Path $state 'backups') -Force | Out-Null
  $values = [ordered]@{
    TTM_OWNER='isolated-local-v1'; TTM_PROJECT="ttm-local-$Name"; MODE=$Mode
    APP_PROFILE=$profile; APP_HOST=$HostAddress; BIND_ADDRESS=$binding; APP_PORT=$Port
    PUBLIC_ORIGIN=$origin; DEV_BACKEND_PORT=$BackendPort; DEV_FRONTEND_PORT=$FrontendPort; DEV_DB_PORT=$DatabasePort
    APP_DB='ttm_local'; PG_ADMIN_PASSWORD=(New-LocalSecret); APP_PASSWORD=(New-LocalSecret)
    JWT_SECRET=(New-LocalSecret); BOOTSTRAP_ADMIN_EMAIL='admin@example.test'
    BOOTSTRAP_ADMIN_PASSWORD=('Local1!' + (New-LocalSecret))
    RELEASE_TAG=('local-' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss') + '-' + $Name)
  }
  ($values.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) |
    Set-Content -LiteralPath $environmentFile -Encoding utf8NoBOM
  Write-Output "Initialized $Name ($Mode). Credentials are in ignored local state; they are not printed."
  Write-Output "Browser origin: $origin"
  return
}

if (!(Test-Path -LiteralPath $environmentFile -PathType Leaf)) { throw 'Initialize this named environment first.' }
$settings = @{}
foreach ($line in Get-Content -LiteralPath $environmentFile) {
  if ($line -match '^([A-Z_]+)=(.*)$') { $settings[$matches[1]] = $matches[2] }
}
if ($settings.TTM_OWNER -ne 'isolated-local-v1' -or $settings.TTM_PROJECT -ne "ttm-local-$Name") {
  throw 'Refusing a configuration outside this isolated local project.'
}
$settings.COMPOSE_PROFILES = if ($settings.MODE -eq 'Dev') { '' } else { 'rehearsal' }
$compose = @('compose','--project-name',$settings.TTM_PROJECT,'--env-file',$environmentFile,
  '-f',(Join-Path $PSScriptRoot 'compose.yaml'))
if ($settings.MODE -eq 'Dev') { $compose += @('-f',(Join-Path $PSScriptRoot 'compose.dev.yaml')) }
else { $compose += @('--profile','rehearsal') }

function Invoke-LocalCompose {
  param([Parameter(ValueFromRemainingArguments)][string[]]$DockerArguments)
  # Shell environment normally overrides env-file values. Pin only our own settings
  # for this call and restore them afterwards; never inherit another stack's secrets.
  $saved = @{}
  try {
    foreach ($key in $settings.Keys) {
      $saved[$key] = [Environment]::GetEnvironmentVariable($key,'Process')
      [Environment]::SetEnvironmentVariable($key,$settings[$key],'Process')
    }
    & docker @compose @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose command failed (exit $LASTEXITCODE)." }
  } finally {
    foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key,$saved[$key],'Process') }
  }
}

function Export-LocalCa {
  if ($settings.MODE -eq 'Dev') { throw 'Dev uses localhost HTTP; HTTPS certificates belong to Rehearsal/Lan.' }
  $certificate = Join-Path $state 'root.crt'
  Invoke-LocalCompose cp 'edge:/data/caddy/pki/authorities/local/root.crt' $certificate
  Write-Output "Exported only the public CA certificate: $certificate"
  Write-Output 'No trust store was modified. Never distribute the CA private key or environment.env.'
}

switch ($Action) {
  Validate { Invoke-LocalCompose config --quiet }
  Start {
    Invoke-LocalCompose config --quiet
    $arguments = @('up','-d','--wait','--wait-timeout','240')
    if (!$NoBuild) { $arguments += '--build' }
    Invoke-LocalCompose @arguments
    if ($settings.MODE -eq 'Dev') {
      Write-Output "Backend: http://127.0.0.1:$($settings.DEV_BACKEND_PORT)"
      Write-Output 'Launch Vite in a separate terminal with DEV_API_TARGET set to that backend address.'
    } else {
      Start-Sleep -Seconds 2
      Export-LocalCa
      Write-Output "Browser origin: $($settings.PUBLIC_ORIGIN)"
    }
  }
  Stop { Invoke-LocalCompose stop }
  Status { Invoke-LocalCompose ps }
  ExportCa { Export-LocalCa }
  Check {
    $curl = if ($IsWindows) { 'curl.exe' } else { 'curl' }
    $arguments = @('--noproxy','*','--silent','--show-error','--fail','--max-time','15')
    if ($settings.MODE -eq 'Dev') { $url = "http://127.0.0.1:$($settings.DEV_BACKEND_PORT)/actuator/health" }
    else {
      $certificate = Join-Path $state 'root.crt'
      if (!(Test-Path -LiteralPath $certificate)) { throw 'Export the public CA certificate first.' }
      $arguments += @('--cacert',$certificate)
      # The private local CA has no public CRL endpoint. Schannel may otherwise
      # reject it as revocation-unknown; chain/hostname verification stays enabled.
      if ($IsWindows) { $arguments += '--ssl-revoke-best-effort' }
      $url = "$($settings.PUBLIC_ORIGIN)/healthz"
    }
    & $curl @arguments $url
    if ($LASTEXITCODE -ne 0) { throw 'Health/TLS verification failed.' }
  }
  Backup {
    $archiveName = 'backup-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '.dump'
    Invoke-LocalCompose exec -T postgres sh -c 'umask 077; pg_dump -U postgres -d "$APP_DB" --format=custom --no-owner --no-privileges --file="/backups/$1"' sh $archiveName
    $destination = Join-Path (Join-Path $state 'backups') $archiveName
    Invoke-LocalCompose cp "postgres:/backups/$archiveName" $destination
    Write-Output "Backup saved: $destination. This is a local copy, not an off-host backup."
  }
  Restore {
    if (!$Archive -or !$TargetDatabase) { throw 'Restore requires -Archive and a new -TargetDatabase restore_... name.' }
    $source = Join-Path (Join-Path $state 'backups') $Archive
    if (!(Test-Path -LiteralPath $source -PathType Leaf)) { throw 'Archive is not in this environment backup directory.' }
    Invoke-LocalCompose cp $source "postgres:/backups/$Archive"
    Invoke-LocalCompose exec -T postgres bash /opt/ttm/restore-database.sh $Archive $TargetDatabase
  }
}
