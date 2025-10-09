# PowerShell setup script for AAC pipeline tools (Windows)

$ErrorActionPreference = "Stop"

$TOOLS_DIR = Join-Path $PWD "tools"
New-Item -ItemType Directory -Force -Path $TOOLS_DIR | Out-Null

Write-Host "Setting up AAC pipeline tools..." -ForegroundColor Cyan
Write-Host ""

# Structurizr CLI
$STRUCTURIZR_VERSION = "2024.11.03"
$STRUCTURIZR_DIR = Join-Path $TOOLS_DIR "structurizr-cli"
$STRUCTURIZR_ZIP = Join-Path $TOOLS_DIR "structurizr-cli.zip"
$STRUCTURIZR_JAR = Join-Path $STRUCTURIZR_DIR "structurizr-cli.jar"

if (Test-Path $STRUCTURIZR_JAR) {
    Write-Host "Structurizr CLI already installed" -ForegroundColor Green
} else {
    Write-Host "Downloading Structurizr CLI..."
    $url = "https://github.com/structurizr/cli/releases/download/v$STRUCTURIZR_VERSION/structurizr-cli.zip"
    Invoke-WebRequest -Uri $url -OutFile $STRUCTURIZR_ZIP

    Write-Host "Extracting Structurizr CLI..."
    New-Item -ItemType Directory -Force -Path $STRUCTURIZR_DIR | Out-Null
    Expand-Archive -Path $STRUCTURIZR_ZIP -DestinationPath $STRUCTURIZR_DIR -Force
    Remove-Item $STRUCTURIZR_ZIP

    Write-Host "Structurizr CLI installed" -ForegroundColor Green
}

Write-Host ""

# PlantUML
$PLANTUML_JAR = Join-Path $TOOLS_DIR "plantuml.jar"
$PLANTUML_VERSION = "1.2024.7"

if (Test-Path $PLANTUML_JAR) {
    Write-Host "PlantUML already installed" -ForegroundColor Green
} else {
    Write-Host "Downloading PlantUML..."
    $url = "https://github.com/plantuml/plantuml/releases/download/v$PLANTUML_VERSION/plantuml-$PLANTUML_VERSION.jar"
    Invoke-WebRequest -Uri $url -OutFile $PLANTUML_JAR

    Write-Host "PlantUML installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "All tools installed successfully!" -ForegroundColor Green
Write-Host "Tools location: $TOOLS_DIR"
Write-Host ""
