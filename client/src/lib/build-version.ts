import buildVersion from '../../../build-version.json';

export const BUILD_MAJOR = buildVersion.major;
export const BUILD_MINOR = buildVersion.minor;
export const BUILD_PATCH = buildVersion.patch;
export const BUILD_NUMBER = buildVersion.build;

export const BUILD_VERSION_STRING = `Build v${BUILD_MAJOR}.${BUILD_MINOR}.${BUILD_PATCH}`;
export const BUILD_VERSION_SHORT = `v${BUILD_MAJOR}.${BUILD_MINOR}.${BUILD_PATCH}`;
