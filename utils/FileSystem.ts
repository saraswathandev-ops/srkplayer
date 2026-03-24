import RNFS from 'react-native-fs';

const prefix = 'file://';

export const documentDirectory = `${prefix}${RNFS.DocumentDirectoryPath}/`;
export const cacheDirectory = `${prefix}${RNFS.CachesDirectoryPath}/`;

function normalizePath(p: string) {
    if (p.startsWith('file://')) {
        return p.replace('file://', '');
    }
    return p;
}

export async function makeDirectoryAsync(path: string, options?: { intermediates?: boolean }): Promise<void> {
    await RNFS.mkdir(normalizePath(path));
}

export async function getInfoAsync(path: string): Promise<{ exists: boolean; isDirectory: boolean; size?: number; uri: string }> {
    try {
        const stats = await RNFS.stat(normalizePath(path));
        return {
            exists: true,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            uri: path,
        };
    } catch {
        return { exists: false, isDirectory: false, uri: path };
    }
}

export async function copyAsync(options: { from: string; to: string }): Promise<void> {
    await RNFS.copyFile(normalizePath(options.from), normalizePath(options.to));
}

export async function deleteAsync(path: string, options?: { idempotent?: boolean }): Promise<void> {
    try {
        await RNFS.unlink(normalizePath(path));
    } catch (e: any) {
        if (!options?.idempotent) {
            throw e;
        }
    }
}

export async function readDirectoryAsync(path: string): Promise<string[]> {
    try {
        const items = await RNFS.readDir(normalizePath(path));
        return items.map(item => item.name);
    } catch (e) {
        throw e;
    }
}

export function createDownloadResumable(
    url: string,
    fileUri: string,
    options?: any,
    callback?: (progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void
) {
    let jobId: number = -1;

    const resumable = {
        downloadAsync: async () => {
            const ret = RNFS.downloadFile({
                fromUrl: url,
                toFile: normalizePath(fileUri),
                progressDivider: 1,
                begin: (res) => {
                    jobId = res.jobId;
                },
                progress: (res) => {
                    if (callback) {
                        callback({
                            totalBytesWritten: res.bytesWritten,
                            totalBytesExpectedToWrite: res.contentLength,
                        });
                    }
                }
            });
            await ret.promise;
            return { uri: fileUri, status: 200, headers: {} };
        },
        pauseAsync: async () => {
            if (jobId !== -1) RNFS.stopDownload(jobId);
        },
        resumeAsync: async () => {
            return resumable.downloadAsync();
        },
        cancelAsync: async () => {
            if (jobId !== -1) RNFS.stopDownload(jobId);
            try {
                await RNFS.unlink(normalizePath(fileUri));
            } catch (e) { }
        }
    };

    return resumable;
}
