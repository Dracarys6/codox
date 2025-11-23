import { DocumentStatus } from '../types';

export interface StatusDisplay {
  text: string;
  className: string;
}

/**
 * 获取文档状态的显示信息
 */
export function getDocumentStatusDisplay(
  status?: DocumentStatus,
  isLocked?: boolean
): StatusDisplay {
  // 兼容旧数据：如果没有status字段，根据is_locked判断
  if (!status) {
    if (isLocked) {
      return {
        text: '已锁定',
        className: 'bg-red-100 text-red-800',
      };
    }
    return {
      text: '已保存',
      className: 'bg-green-100 text-green-800',
    };
  }

  switch (status) {
    case 'draft':
      return {
        text: '草稿',
        className: 'bg-gray-100 text-gray-800',
      };
    case 'saved':
      return {
        text: '已保存',
        className: 'bg-green-100 text-green-800',
      };
    case 'published':
      return {
        text: '已发布',
        className: 'bg-blue-100 text-blue-800',
      };
    case 'archived':
      return {
        text: '已归档',
        className: 'bg-yellow-100 text-yellow-800',
      };
    case 'locked':
      return {
        text: '已锁定',
        className: 'bg-red-100 text-red-800',
      };
    default:
      return {
        text: '未知',
        className: 'bg-gray-100 text-gray-800',
      };
  }
}

