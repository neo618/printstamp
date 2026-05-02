export default {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html'],
  transform: {},
  moduleFileExtensions: ['js'],
  verbose: true,
  testTimeout: 10000
};
