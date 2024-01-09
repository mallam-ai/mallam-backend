#!/bin/bash

set -eu

pnpm drizzle-kit generate:sqlite --schema=./schema-$1.ts --out drizzle-$1
