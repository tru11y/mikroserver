param(
  [string]$BuildDir = "C:\dev\mikroserver-mobile-build",
  [string]$PackageName = "com.mikroserver.app",
  [string]$ActivityName = "com.mikroserver.app.MainActivity",
  [ValidateSet("release", "debug")]
  [string]$Variant = "release",
  [switch]$SkipSync,
  [switch]$SkipNpm,
  [switch]$SkipBuild,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-RobocopySuccess([int]$Code) {
  if ($Code -gt 7) {
    throw "Robocopy failed with exit code $Code."
  }
}

function Resolve-MobileRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Resolve-AdbPath {
  $candidates = @()
  if ($env:ANDROID_SDK_ROOT) {
    $candidates += (Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe")
  }
  if ($env:ANDROID_HOME) {
    $candidates += (Join-Path $env:ANDROID_HOME "platform-tools\adb.exe")
  }
  $candidates += (Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe")

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "adb.exe introuvable. Installe Android platform-tools ou configure ANDROID_SDK_ROOT."
}

function Ensure-Java17 {
  $jdk17 = "C:\Program Files\Java\jdk-17"
  if (Test-Path $jdk17) {
    $env:JAVA_HOME = $jdk17
    if (-not $env:PATH.StartsWith("$jdk17\bin")) {
      $env:PATH = "$jdk17\bin;$env:PATH"
    }
    return
  }

  if (-not $env:JAVA_HOME) {
    throw "JDK 17 introuvable (attendu: C:\Program Files\Java\jdk-17)."
  }
}

$mobileRoot = Resolve-MobileRoot
$androidDir = Join-Path $BuildDir "android"
$gradleTask = if ($Variant -eq "release") { "assembleRelease" } else { "assembleDebug" }
$apkBuilt = Join-Path $BuildDir "android\app\build\outputs\apk\$Variant\app-$Variant.apk"
$artifactsDir = Join-Path $mobileRoot "artifacts"
$apkTarget = Join-Path $artifactsDir "app-$Variant.apk"
$adb = Resolve-AdbPath

if (-not $SkipSync) {
  Write-Step "Sync vers dossier court"
  New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
  robocopy $mobileRoot $BuildDir /MIR /R:2 /W:2 /XD node_modules .expo dist web-build android\.gradle android\build android\app\build artifacts .git
  Ensure-RobocopySuccess $LASTEXITCODE
}

if (-not $SkipNpm) {
  Write-Step "Installation des deps npm"
  Push-Location $BuildDir
  try {
    npm install
  } finally {
    Pop-Location
  }
}

if (-not $SkipBuild) {
  Write-Step "Build APK $Variant (Gradle)"
  Ensure-Java17
  Push-Location $androidDir
  try {
    cmd /c "gradlew.bat $gradleTask"
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $apkBuilt)) {
  throw "APK non trouve: $apkBuilt"
}

Write-Step "Copie APK vers artifacts"
New-Item -ItemType Directory -Path $artifactsDir -Force | Out-Null
Copy-Item -LiteralPath $apkBuilt -Destination $apkTarget -Force
Write-Host "APK: $apkTarget" -ForegroundColor Green

if (-not $SkipInstall) {
  Write-Step "Installation via adb"
  & $adb start-server | Out-Null
  $devices = & $adb devices
  if (-not ($devices -match "`tdevice")) {
    throw "Aucun appareil Android detecte. Branche le tel + active le debug USB."
  }

  & $adb install -r $apkTarget
  if ($LASTEXITCODE -ne 0) {
    throw "adb install failed with exit code $LASTEXITCODE."
  }

  & $adb shell am start -n "$PackageName/$ActivityName"
  if ($LASTEXITCODE -ne 0) {
    throw "Echec lancement app via adb."
  }
}

Write-Step "Termine"
Write-Host "Build + install Android OK." -ForegroundColor Green
