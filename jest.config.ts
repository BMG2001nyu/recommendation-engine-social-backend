import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/db/seed.ts',
    '!src/server.ts',
  ],
  coverageThreshold: {
    global: { branches: 55, functions: 65, lines: 65, statements: 65 },
  },
  testTimeout: 15000,
  globals: {
    'ts-jest': {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
      },
    },
  },
}

export default config
