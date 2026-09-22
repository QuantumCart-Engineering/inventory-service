module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  roots: [
    "<rootDir>/src"
  ],

  testMatch: [
    "**/__tests__/**/*.test.ts"
  ],

  moduleFileExtensions: [
    "ts",
    "js",
    "json"
  ],

  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/server.ts",
    "!src/scripts/**"
  ],

  coverageDirectory: "coverage",

  clearMocks: true,

  verbose: true,

  setupFiles: [
    "<rootDir>/src/__tests__/integration/test-env.ts"
  ]
};