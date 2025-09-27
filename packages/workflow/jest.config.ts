import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          isolatedModules: true,
        },
      },
    ],
  },
  displayName: '@credo-ts/workflow',
  testMatch: ['**/?(*.)test.ts', '**/?(*.)spec.ts'],
  setupFilesAfterEnv: ['./src/tests/setup.ts'],
}

export default config
