import * as core from '@actions/core';
import { GlueClient, CreateDatabaseCommand, GetDatabaseCommand, DatabaseInput } from '@aws-sdk/client-glue';

/**
 * Wait for database to be available by polling GetDatabase
 * @param glueClient - Glue client instance
 * @param databaseName - Name of the database to check
 * @param catalogId - Optional catalog ID
 * @param maxAttempts - Maximum number of polling attempts (default: 10)
 * @param delayMs - Delay between attempts in milliseconds (default: 1000)
 */
async function waitForDatabase(
  glueClient: GlueClient,
  databaseName: string,
  catalogId?: string,
  maxAttempts = 10,
  delayMs = 1000
): Promise<void> {
  core.info('Verifying database is available...');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await glueClient.send(new GetDatabaseCommand({
        CatalogId: catalogId,
        Name: databaseName,
      }));
      core.info(`✓ Database verified available after ${attempt} attempt(s)`);
      return;
    } catch (error: any) {
      if (error.name === 'EntityNotFoundException') {
        if (attempt < maxAttempts) {
          core.info(`Database not yet available (attempt ${attempt}/${maxAttempts}), waiting ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          throw new Error(`Database ${databaseName} was created but failed to become available after ${maxAttempts} attempts`);
        }
      } else {
        // Unexpected error
        throw error;
      }
    }
  }
}

/**
 * Main action entry point
 * Creates an AWS Glue Data Catalog database with optional if-not-exists behavior
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const databaseName = core.getInput('database-name', { required: true });
    const description = core.getInput('description') || undefined;
    const locationUri = core.getInput('location-uri') || undefined;
    const parametersJson = core.getInput('parameters') || undefined;
    const catalogId = core.getInput('catalog-id') || undefined;
    const ifNotExists = core.getInput('if-not-exists') !== 'false';

    core.info(`Creating Glue database: ${databaseName}`);
    core.info(`If-not-exists mode: ${ifNotExists}`);

    // Parse parameters if provided
    let parameters: Record<string, string> | undefined;
    if (parametersJson) {
      try {
        parameters = JSON.parse(parametersJson);
        if (typeof parameters !== 'object' || Array.isArray(parameters)) {
          throw new Error('Parameters must be a JSON object');
        }
      } catch (error) {
        throw new Error(`Failed to parse parameters JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Build database input
    const databaseInput: DatabaseInput = {
      Name: databaseName,
    };

    if (description) {
      databaseInput.Description = description;
    }

    if (locationUri) {
      databaseInput.LocationUri = locationUri;
    }

    if (parameters) {
      databaseInput.Parameters = parameters;
    }

    // Create Glue client
    const glueClient = new GlueClient({});

    // Check if database exists
    let alreadyExists = false;
    try {
      core.info('Checking if database already exists...');
      await glueClient.send(new GetDatabaseCommand({
        CatalogId: catalogId,
        Name: databaseName,
      }));
      alreadyExists = true;
      core.info('Database already exists');

      if (ifNotExists) {
        core.info('if-not-exists=true: Silently succeeding without error');
      } else {
        throw new Error(`Database ${databaseName} already exists and if-not-exists=false`);
      }
    } catch (error: any) {
      if (error.name === 'EntityNotFoundException') {
        core.info('Database does not exist, will create');

        // Create the database
        core.info('Creating new database...');
        await glueClient.send(new CreateDatabaseCommand({
          CatalogId: catalogId,
          DatabaseInput: databaseInput,
        }));
        core.info('Database created successfully');

        // Wait for database to be available
        await waitForDatabase(glueClient, databaseName, catalogId);
      } else if (error.message?.includes('already exists')) {
        // Re-throw our own error about database existing
        throw error;
      } else {
        // Unexpected error during GetDatabase
        throw error;
      }
    }

    // Set outputs
    const accountId = catalogId || (process.env.AWS_ACCOUNT_ID || '*');
    const region = process.env.AWS_REGION || 'us-east-1';
    const databaseArn = `arn:aws:glue:${region}:${accountId}:database/${databaseName}`;

    core.setOutput('database-name', databaseName);
    core.setOutput('database-arn', databaseArn);
    core.setOutput('already-exists', alreadyExists.toString());

    const status = alreadyExists ? 'already exists' : 'created';
    core.info(`✓ Action completed successfully - database ${databaseName} ${status}`);
  } catch (error) {
    // Provide comprehensive error information
    core.error('Action failed with error:');

    if (error instanceof Error) {
      core.error(`Error: ${error.message}`);

      if (error.stack) {
        core.error('Stack trace:');
        core.error(error.stack);
      }

      // Check for AWS SDK specific errors
      if ('Code' in error || '$metadata' in error) {
        core.error('AWS SDK Error Details:');
        const awsError = error as any;

        if (awsError.Code) {
          core.error(`  Error Code: ${awsError.Code}`);
        }
        if (awsError.$metadata) {
          core.error(`  HTTP Status: ${awsError.$metadata.httpStatusCode}`);
          core.error(`  Request ID: ${awsError.$metadata.requestId}`);
        }
        if (awsError.message) {
          core.error(`  Message: ${awsError.message}`);
        }
      }

      core.setFailed(`Action failed: ${error.message}`);
    } else {
      core.error(`Unknown error type: ${typeof error}`);
      core.error(`Error value: ${JSON.stringify(error, null, 2)}`);
      core.setFailed('An unknown error occurred - check logs for details');
    }
  }
}

// Run the action
run();
