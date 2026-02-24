export const getShareBaseUrl = (): string => {
  const projectId = '932358f2-26f5-465a-b493-c072c610ccf5';
  if (window.location.hostname.includes('id-preview') || 
      window.location.hostname.includes('lovable.app')) {
    return `https://${projectId}.lovableproject.com`;
  }
  return window.location.origin;
};
