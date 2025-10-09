#!/bin/bash
# Setup script for AAC pipeline tools

set -e

TOOLS_DIR="$(pwd)/tools"
mkdir -p "$TOOLS_DIR"

echo "Setting up AAC pipeline tools..."
echo ""

# Structurizr CLI
STRUCTURIZR_VERSION="2024.11.03"
STRUCTURIZR_DIR="$TOOLS_DIR/structurizr-cli"
STRUCTURIZR_ZIP="$TOOLS_DIR/structurizr-cli.zip"
STRUCTURIZR_JAR="$STRUCTURIZR_DIR/structurizr-cli.jar"

if [ -f "$STRUCTURIZR_JAR" ]; then
    echo "✓ Structurizr CLI already installed"
else
    echo "Downloading Structurizr CLI v$STRUCTURIZR_VERSION..."
    curl -L -o "$STRUCTURIZR_ZIP" \
        "https://github.com/structurizr/cli/releases/download/v$STRUCTURIZR_VERSION/structurizr-cli.zip"

    echo "Extracting Structurizr CLI..."
    mkdir -p "$STRUCTURIZR_DIR"
    unzip -q "$STRUCTURIZR_ZIP" -d "$STRUCTURIZR_DIR"
    rm "$STRUCTURIZR_ZIP"

    echo "✓ Structurizr CLI installed"
fi

echo ""

# PlantUML
PLANTUML_JAR="$TOOLS_DIR/plantuml.jar"
PLANTUML_VERSION="1.2024.7"

if [ -f "$PLANTUML_JAR" ]; then
    echo "✓ PlantUML already installed"
else
    echo "Downloading PlantUML v$PLANTUML_VERSION..."
    curl -L -o "$PLANTUML_JAR" \
        "https://github.com/plantuml/plantuml/releases/download/v$PLANTUML_VERSION/plantuml-$PLANTUML_VERSION.jar"

    echo "✓ PlantUML installed"
fi

echo ""
echo "✓ All tools installed successfully!"
echo ""
echo "Tools location: $TOOLS_DIR"
echo "  - Structurizr CLI: $STRUCTURIZR_JAR"
echo "  - PlantUML: $PLANTUML_JAR"
echo ""
