# Integration Tests

This document provides a detailed overview of the integration testing framework used in this project.

## Overview

The integration tests are designed to validate the end-to-end functionality of the Gemini CLI. They execute the built binary in a controlled environment and verify that it behaves as expected when interacting with the file system.

These tests are located in the `integration-tests` directory and are run using a custom test runner that provides a consistent and configurable testing environment.

## Running the Tests

The integration tests are not run as part of the default `npm run test` command. They must be run explicitly using the `npm run integration-test` script.

### Running All Tests

To run the entire suite of integration tests, use the following command:

```bash
npm run integration-test
```

### Running a Single Test File

To run a specific test file, provide the path to the file as an argument:

```bash
npm run integration-test -- integration-tests/file-system.test.js
```

### Running a Single Test by Name

To run a single test by its name, use the `--test-name-pattern` flag:

```bash
npm run integration-test -- --test-name-pattern "reads a file"
```

## Debugging

The integration test runner provides a `--keep-output` flag that can be used to preserve the test artifacts for debugging. When this flag is used, the temporary directories created during the test run will not be deleted.

```bash
npm run integration-test -- --keep-output
```

When the `--keep-output` flag is used, the test runner will print the path to the unique directory for the test run.

## Directory Structure

The integration tests create a unique directory for each test run inside the `.integration-tests` directory. Within this directory, a subdirectory is created for each test file, and within that, a subdirectory is created for each individual test case.

This structure makes it easy to locate the artifacts for a specific test run, file, or case.

```
.integration-tests/
└── <run-id>/
    └── <test-file-name>.test.js/
        └── <test-case-name>/
            └── ...test artifacts...
```
