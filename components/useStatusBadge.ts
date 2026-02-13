export function useStatusBadge(status: string) {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ready':
        return '#4CAF50'; // Green
      case 'processing':
        return '#FF9800'; // Orange
      case 'upload_failed':
      case 'queued_failed':
        return '#FF3B30'; // Red
      case 'uploading':
        return '#2196F3'; // Blue
      case 'recorded':
      default:
        return '#999'; // Gray
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'processing':
        return 'Processing';
      case 'upload_failed':
        return 'Upload Failed';
      case 'queued_failed':
        return 'Processing Failed';
      case 'uploading':
        return 'Uploading';
      case 'recorded':
        return 'Recorded';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const backgroundColor = getStatusColor(status);
  const text = getStatusText(status);

  return {
    backgroundColor,
    text,
  };
}
