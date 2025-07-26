module.exports = {
  testEnvironment: "node",
  testMatch: ["**/test/simple.test.js"],
  collectCoverageFrom: [
    "index.js",
    "scripts/**/*.js",
    "!**/node_modules/**",
    "!**/coverage/**",
  ],
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 50,
  //     statements: 50,
  //   },
  // },
  setupFilesAfterEnv: ["<rootDir>/test/setup.js"],
  testTimeout: 10000,
};
