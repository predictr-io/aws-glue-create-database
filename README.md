# AWS Glue Create Database Action

GitHub Action to create AWS Glue Data Catalog databases with optional if-not-exists behavior.

## Features

- Create new Glue databases
- Optional if-not-exists mode (silently succeeds if database already exists)
- Support for database description, location URI, and custom parameters
- Support for cross-account catalog access
- Comprehensive error reporting

## Usage

### Basic Usage

```yaml
- name: Create Glue database
  uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'my_database'
```

### With Description and Location

```yaml
- name: Create Glue database with metadata
  uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'analytics'
    description: 'Analytics data warehouse'
    location-uri: 's3://my-bucket/analytics/'
```

### With Custom Parameters

```yaml
- name: Create database with parameters
  uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'my_database'
    description: 'Production database'
    parameters: |
      {
        "environment": "production",
        "owner": "data-team",
        "version": "1.0"
      }
```

### Fail if Database Exists

```yaml
- name: Create database (fail if exists)
  uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'my_database'
    if-not-exists: false
```

## Authentication

This action requires AWS credentials to be configured. Use the official AWS configure credentials action:

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
    aws-region: us-east-1

- uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'my_database'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `database-name` | Yes | - | Name of the Glue database to create |
| `description` | No | - | Description of the database |
| `location-uri` | No | - | Location URI for the database (e.g., s3://my-bucket/database/) |
| `parameters` | No | - | Database parameters as JSON object (key-value pairs) |
| `catalog-id` | No | current account | AWS account ID for cross-account access |
| `if-not-exists` | No | true | If true, silently succeed if database already exists |

## Outputs

| Output | Description |
|--------|-------------|
| `database-name` | Name of the created database |
| `database-arn` | ARN of the created database |
| `already-exists` | "true" if database already existed, "false" if newly created |

## Examples

### Complete Workflow

```yaml
name: Setup Glue Database
on:
  push:
    branches: [main]

jobs:
  setup-database:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: us-east-1

      - name: Create Glue database
        uses: predictr-io/aws-glue-create-database@v0
        with:
          database-name: 'my_database'
          description: 'My analytics database'
          location-uri: 's3://my-bucket/data/'
        id: create-db

      - name: Check if database was created
        run: |
          echo "Database: ${{ steps.create-db.outputs.database-name }}"
          echo "ARN: ${{ steps.create-db.outputs.database-arn }}"
          echo "Already existed: ${{ steps.create-db.outputs.already-exists }}"
```

### Create Database Then Table

```yaml
- name: Create database
  uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'analytics'
    description: 'Analytics data warehouse'
    location-uri: 's3://analytics-bucket/'

- name: Create table in database
  uses: predictr-io/aws-glue-create-table@v0
  with:
    database-name: 'analytics'
    table-name: 'events'
    table-input: |
      {
        "Name": "events",
        "StorageDescriptor": {
          "Columns": [
            {"Name": "event_id", "Type": "string"},
            {"Name": "timestamp", "Type": "timestamp"}
          ],
          "Location": "s3://analytics-bucket/events/"
        }
      }
```

### Cross-Account Database

```yaml
- name: Create database in another account
  uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'shared_database'
    catalog-id: '987654321098'
    description: 'Shared cross-account database'
```

### Multiple Databases

```yaml
- name: Create dev database
  uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'analytics_dev'
    description: 'Development environment'
    parameters: '{"environment": "dev"}'

- name: Create staging database
  uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'analytics_staging'
    description: 'Staging environment'
    parameters: '{"environment": "staging"}'

- name: Create prod database
  uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'analytics_prod'
    description: 'Production environment'
    parameters: '{"environment": "production"}'
```

## IAM Permissions

The AWS credentials used by this action need the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "glue:CreateDatabase",
        "glue:GetDatabase"
      ],
      "Resource": [
        "arn:aws:glue:*:*:catalog",
        "arn:aws:glue:*:*:database/*"
      ]
    }
  ]
}
```

## Common Use Cases

### 1. Idempotent Database Setup

Use `if-not-exists: true` (default) to make database creation idempotent - safe to run multiple times:

```yaml
- uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'my_database'
    if-not-exists: true  # default
```

### 2. Strict Database Creation

Use `if-not-exists: false` when you want to ensure the database is newly created:

```yaml
- uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'my_database'
    if-not-exists: false  # fail if exists
```

### 3. Database Per Environment

Create separate databases for different environments:

```yaml
- uses: predictr-io/aws-glue-create-database@v0
  with:
    database-name: 'myapp_${{ github.ref_name }}'
    description: 'Database for branch ${{ github.ref_name }}'
    parameters: |
      {
        "branch": "${{ github.ref_name }}",
        "created_by": "${{ github.actor }}"
      }
```

## License

MIT
