// Web shim for the native react-native-fs package.
// Browser builds must not parse the native Flow-based implementation.
export const DocumentDirectoryPath = "";
export const CachesDirectoryPath = "";
export const ExternalStorageDirectoryPath = "";

const unsupported = async (..._args: unknown[]): Promise<never> => {
  throw new Error("react-native-fs is only available in the native app.");
};

const RNFS = {
  DocumentDirectoryPath,
  CachesDirectoryPath,
  ExternalStorageDirectoryPath,
  exists: async (_path: string) => false,
  stat: unsupported,
  read: unsupported,
  readFile: unsupported,
  writeFile: unsupported,
  appendFile: unsupported,
  mkdir: unsupported,
};

export default RNFS;
