#requires -Version 7.2
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('Init','Backend','Frontend','Check')][string]$Action,
  [ValidatePattern('^[a-z][a-z0-9_]{0,62}$')][string]$DatabaseName = 'team_task_manager_native_dev',
  [ValidatePattern('^[a-z][a-z0-9_]{0,62}$')][string]$DatabaseUser = 'ttm_native_dev',
  [ValidateRange(1024,65535)][int]$DatabasePort = 5433,
  [ValidateRange(1024,65535)][int]$BackendPort = 8080,
  [ValidateRange(1024,65535)][int]$FrontendPort = 5173,
  [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9_.-]+$')][string]$PostgresContainer = 'team-task-manager-postgres',
  [string]$JavaHome
)
$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$stateDirectory = Join-Path $PSScriptRoot 'state'
$environmentFile = Join-Path $stateDirectory 'environment.env'
$pendingFile = Join-Path $stateDirectory 'environment.pending.env'

function Read-NativeEnvironment([string]$Path) {
  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*([A-Z_]+)\s*=(.*)$') {
      $value = $matches[2].Trim()
      if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1,$value.Length - 2)
      }
      $values[$matches[1]] = $value
    }
  }
  return $values
}

function Invoke-NativePostgres([string]$Sql,[string]$AdminUser,[string]$AdminPassword) {
  $savedPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD','Process')
  try {
    $env:PGPASSWORD = $AdminPassword
    # Credentials/SQL travel through environment/stdin, never command arguments or logs.
    $output = $Sql | & docker exec -i --env PGPASSWORD $PostgresContainer psql --host=127.0.0.1 --username=$AdminUser --dbname=postgres --no-password --tuples-only --no-align --set=ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL setup failed. SQL and credentials were not printed; any pending setup file is retained for diagnosis.' }
    return ($output -join "`n").Trim()
  } finally {
    [Environment]::SetEnvironmentVariable('PGPASSWORD',$savedPassword,'Process')
  }
}

function Assert-NativePortFree([int]$Port) {
  if (@([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -eq $Port).Count -gt 0) {
    throw "Port $Port is occupied. Stop the competing server or choose ports during Init; no process was stopped."
  }
}

if ($Action -eq 'Init') {
  if ((Test-Path -LiteralPath $environmentFile) -or (Test-Path -LiteralPath $pendingFile)) {
    throw 'Native setup already exists or is incomplete. Reuse Backend/Frontend; Init never rotates credentials, adopts a database or resets data.'
  }
  $rootEnvironment = Join-Path $repository '.env'
  if (!(Test-Path -LiteralPath $rootEnvironment -PathType Leaf)) { throw 'Init requires the existing Docker PostgreSQL administrator settings in the repository .env.' }
  $administrator = Read-NativeEnvironment $rootEnvironment
  if (!$administrator.POSTGRES_USER -or !$administrator.POSTGRES_PASSWORD) { throw 'POSTGRES_USER and POSTGRES_PASSWORD must identify the existing Docker PostgreSQL administrator.' }
  $portJson = & docker inspect $PostgresContainer --format '{{json .NetworkSettings.Ports}}'
  if ($LASTEXITCODE -ne 0) { throw 'Start the existing PostgreSQL container before Init.' }
  $publishedPorts = ($portJson | ConvertFrom-Json).'5432/tcp'
  if (@($publishedPorts | Where-Object HostPort -eq "$DatabasePort").Count -eq 0) { throw 'DatabasePort does not match the selected container publication.' }
  $existing = Invoke-NativePostgres "SELECT (SELECT count(*) FROM pg_database WHERE datname='$DatabaseName') + (SELECT count(*) FROM pg_roles WHERE rolname='$DatabaseUser');" $administrator.POSTGRES_USER $administrator.POSTGRES_PASSWORD
  if ($existing -ne '0') { throw 'The requested database or role already exists. Choose unused names; nothing was changed.' }
  $secret = { [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant() }
  $settings = [ordered]@{
    TTM_NATIVE_OWNER='native-local-v1'; POSTGRES_CONTAINER=$PostgresContainer
    DATABASE_NAME=$DatabaseName; DATABASE_USER=$DatabaseUser; DATABASE_PORT=$DatabasePort
    BACKEND_PORT=$BackendPort; FRONTEND_PORT=$FrontendPort
    DB_URL="jdbc:postgresql://127.0.0.1:$DatabasePort/$DatabaseName"
    DB_USERNAME=$DatabaseUser; DB_PASSWORD=(& $secret)
    JWT_SECRET=(& $secret); JWT_ISSUER='ttm-native-dev'
    AUTH_REFRESH_COOKIE_NAME='ttm_native_dev_refresh'
    FRONTEND_URL="http://localhost:$FrontendPort"
    BOOTSTRAP_ADMIN_EMAIL='admin@example.test'; BOOTSTRAP_ADMIN_PASSWORD=('Local1!' + (& $secret))
  }
  New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
  # Preserve generated credentials if provisioning is interrupted. Never delete partial DBs automatically.
  ($settings.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) | Set-Content -LiteralPath $pendingFile -Encoding utf8NoBOM
  $sql = @"
CREATE ROLE "$DatabaseUser" LOGIN PASSWORD '$($settings.DB_PASSWORD)' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE DATABASE "$DatabaseName" OWNER "$DatabaseUser";
"@
  $null = Invoke-NativePostgres $sql $administrator.POSTGRES_USER $administrator.POSTGRES_PASSWORD
  Move-Item -LiteralPath $pendingFile -Destination $environmentFile
  Write-Output "Created separate database $DatabaseName and dedicated login $DatabaseUser. Existing databases were not modified."
  Write-Output "Generated credentials: $environmentFile (ignored by Git; do not share)."
  Write-Output "Next: run Backend and Frontend in separate terminals. Browser: $($settings.FRONTEND_URL)"
  return
}

if (!(Test-Path -LiteralPath $environmentFile -PathType Leaf)) { throw 'Run Init once to create the separate native development database.' }
$settings = Read-NativeEnvironment $environmentFile
if ($settings.TTM_NATIVE_OWNER -ne 'native-local-v1' -or $settings.DATABASE_NAME -notmatch '^[a-z][a-z0-9_]{0,62}$' -or $settings.DATABASE_USER -notmatch '^[a-z][a-z0-9_]{0,62}$') { throw 'Invalid native setup identity.' }
foreach ($key in @('DATABASE_PORT','BACKEND_PORT','FRONTEND_PORT')) {
  $number = 0
  if (![int]::TryParse($settings[$key],[ref]$number) -or $number -lt 1024 -or $number -gt 65535) { throw "Invalid $key in native settings." }
}
if ($settings.DB_URL -ne "jdbc:postgresql://127.0.0.1:$($settings.DATABASE_PORT)/$($settings.DATABASE_NAME)" -or $settings.DB_USERNAME -ne $settings.DATABASE_USER -or $settings.FRONTEND_URL -ne "http://localhost:$($settings.FRONTEND_PORT)") { throw 'Native settings must describe the explicit loopback development database and browser origin.' }
foreach ($key in @('DB_PASSWORD','JWT_SECRET','JWT_ISSUER','AUTH_REFRESH_COOKIE_NAME','BOOTSTRAP_ADMIN_EMAIL','BOOTSTRAP_ADMIN_PASSWORD')) {
  if ([string]::IsNullOrWhiteSpace($settings[$key])) { throw "Missing $key in native settings." }
}

if ($Action -eq 'Check') {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$($settings.BACKEND_PORT)/actuator/health" -TimeoutSec 10 -NoProxy
  if ($health.status -ne 'UP') { throw 'The native backend is not healthy.' }
  Write-Output 'Native backend health: UP'
  return
}

$launch = @{}
if ($Action -eq 'Backend') {
  Assert-NativePortFree ([int]$settings.BACKEND_PORT)
  foreach ($key in @('DB_URL','DB_USERNAME','DB_PASSWORD','JWT_SECRET','JWT_ISSUER','AUTH_REFRESH_COOKIE_NAME','BOOTSTRAP_ADMIN_EMAIL','BOOTSTRAP_ADMIN_PASSWORD','FRONTEND_URL')) { $launch[$key] = $settings[$key] }
  $launch.SPRING_PROFILES_ACTIVE = 'local'
  $launch.SERVER_ADDRESS = '127.0.0.1'
  $launch.SERVER_PORT = $settings.BACKEND_PORT
  $launch.SPRING_DATASOURCE_URL = $settings.DB_URL
  $launch.SPRING_DATASOURCE_USERNAME = $settings.DB_USERNAME
  $launch.SPRING_DATASOURCE_PASSWORD = $settings.DB_PASSWORD
  $launch.SPRING_FLYWAY_URL = $settings.DB_URL
  $launch.SPRING_FLYWAY_USER = $settings.DB_USERNAME
  $launch.SPRING_FLYWAY_PASSWORD = $settings.DB_PASSWORD
  $launch.SPRING_FLYWAY_ENABLED = 'true'
  $launch.SPRING_FLYWAY_BASELINE_ON_MIGRATE = 'false'
  $launch.SPRING_FLYWAY_CLEAN_DISABLED = 'true'
  $launch.SPRING_JPA_HIBERNATE_DDL_AUTO = 'validate'
  $launch.SPRING_APPLICATION_JSON = $null
  if ($JavaHome) {
    if (!(Test-Path -LiteralPath (Join-Path $JavaHome 'bin/javac.exe') -PathType Leaf)) { throw 'JavaHome must point to a JDK.' }
    $launch.JAVA_HOME = $JavaHome
  }
  $workingDirectory = Join-Path $repository 'backend'
} else {
  Assert-NativePortFree ([int]$settings.FRONTEND_PORT)
  # Explicit same-origin URL also overrides old .env values on shells that unset empty variables.
  $launch.VITE_API_URL = $settings.FRONTEND_URL
  $launch.DEV_API_TARGET = "http://127.0.0.1:$($settings.BACKEND_PORT)"
  $workingDirectory = Join-Path $repository 'frontend'
}
$saved = @{}
try {
  foreach ($key in $launch.Keys) {
    $saved[$key] = [Environment]::GetEnvironmentVariable($key,'Process')
    [Environment]::SetEnvironmentVariable($key,$launch[$key],'Process')
  }
  Push-Location -LiteralPath $workingDirectory
  try {
    if ($Action -eq 'Backend') {
      Write-Output "Native backend: http://127.0.0.1:$($settings.BACKEND_PORT); database: $($settings.DATABASE_NAME)"
      & .\mvnw.cmd spring-boot:run
    } else {
      if (!(Test-Path -LiteralPath 'node_modules' -PathType Container)) { throw 'Run npm ci in frontend first.' }
      Write-Output "Browser: $($settings.FRONTEND_URL); API proxy: $($launch.DEV_API_TARGET)"
      & npm run dev -- --host localhost --port $settings.FRONTEND_PORT --strictPort
    }
    if ($LASTEXITCODE -ne 0) { throw "Native $Action exited with code $LASTEXITCODE." }
  } finally { Pop-Location }
} finally {
  foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key,$saved[$key],'Process') }
}
