/**
 * 快照相关工具函数
 */

/**
 * 计算 SHA256 哈希值
 */
export async function calculateSHA256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * 上传快照到 MinIO
 * 通过后端接口上传文件到 MinIO，返回文件 URL
 */
export async function uploadSnapshot(
    docId: number,
    snapshot: number[],
    sha256: string
): Promise<string> {
    // 将快照数据转换为 base64
    const uint8Array = new Uint8Array(snapshot);
    console.log('uploadSnapshot: Converting to base64, uint8Array length:', uint8Array.length);
    console.log('uploadSnapshot: First 20 bytes:', Array.from(uint8Array.slice(0, 20)));
    
    const snapshotBlob = new Blob([uint8Array], { type: 'application/octet-stream' });
    console.log('uploadSnapshot: Blob size:', snapshotBlob.size);
    
    const base64Snapshot = await blobToBase64(snapshotBlob);
    console.log('uploadSnapshot: Base64 length:', base64Snapshot.length);
    console.log('uploadSnapshot: Base64 first 50 chars:', base64Snapshot.substring(0, 50));
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `snapshot-${timestamp}-${sha256.substring(0, 8)}.bin`;
    
    // 调用后端上传接口
    const { apiClient } = await import('../api/client');
    console.log('uploadSnapshot: Calling backend upload API...');
    const result = await apiClient.uploadSnapshot(docId, {
        data: base64Snapshot,
        filename: filename
    });
    
    console.log('uploadSnapshot: Backend returned URL:', result.snapshot_url);
    return result.snapshot_url;
}

/**
 * 将 Blob 转换为 base64 字符串
 */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                // 移除 data URL 前缀（data:application/octet-stream;base64,）
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            } else {
                reject(new Error('Failed to convert blob to base64'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

