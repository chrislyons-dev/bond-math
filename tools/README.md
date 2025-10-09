# AAC Pipeline Tools

This directory contains the tools required for rendering architecture diagrams.

## Required Tools

### 1. Structurizr CLI

Download the latest release from: https://github.com/structurizr/cli/releases

Extract the ZIP file to: `tools/structurizr-cli/`

The `structurizr-cli.jar` file should be at:

```
tools/structurizr-cli/structurizr-cli.jar
```

### 2. PlantUML

Download the latest JAR from: https://github.com/plantuml/plantuml/releases

Save as: `tools/plantuml.jar`

## Directory Structure

```
tools/
├── README.md (this file)
├── structurizr-cli/
│   └── structurizr-cli.jar
└── plantuml.jar
```

## Requirements

- Java 11 or higher must be installed
- Check with: `java -version`

## Verification

Once installed, verify the tools:

```bash
# Test Structurizr CLI
java -jar tools/structurizr-cli/structurizr-cli.jar

# Test PlantUML
java -jar tools/plantuml.jar -version
```

## Usage

The tools are used automatically by the AAC pipeline:

```bash
npm run docs:arch        # Full pipeline including diagram rendering
npm run docs:arch:render # Just render diagrams
```
