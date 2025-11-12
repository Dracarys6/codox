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
 * 注意：这里需要后端提供上传接口，或者直接使用 MinIO 的 presigned URL
 * 目前先返回一个占位符，实际实现需要根据后端接口调整
 */
export async function uploadSnapshot(
    docId: number,
    snapshot: number[],
    sha256: string
): Promise<string> {
    // TODO: 实现实际上传逻辑
    // 方案1：调用后端接口上传
    // 方案2：获取 presigned URL 后直接上传到 MinIO
    // 目前返回一个占位符 URL
    const snapshotBlob = new Blob([new Uint8Array(snapshot)], { type: 'application/octet-stream' });
    const snapshotJson = JSON.stringify(Array.from(new Uint8Array(snapshot)));
    
    // 临时方案：使用 base64 编码存储在 URL 中（仅用于开发测试）
    // 生产环境应该上传到 MinIO
    const base64Snapshot = btoa(snapshotJson);
    return `data:application/json;base64,${base64Snapshot}`;
    
    // 实际实现示例（需要后端支持）：
    // const formData = new FormData();
    // formData.append('file', snapshotBlob);
    // formData.append('doc_id', docId.toString());
    // formData.append('sha256', sha256);
    // 
    // const response = await fetch('/api/upload/snapshot', {
    //     method: 'POST',
    //     body: formData,
    //     headers: {
    //         'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    //     }
    // });
    // 
    // const data = await response.json();
    // return data.url;
}

