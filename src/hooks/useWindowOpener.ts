import { useCallback } from 'react';

/**
 * A hook to handle opening URLs in a new window
 * @param options The window options like width, height, etc.
 * @returns A function to open a URL in a new window
 */
export const useWindowOpener = (options: {
  width?: number;
  height?: number;
  fullscreen?: boolean;
  name?: string;
} = {}) => {
  const {
    width = 1200,
    height = 800,
    fullscreen = false,
    name = 'survey_editor',
  } = options;

  const openInNewWindow = useCallback((url: string) => {
    // Set window features
    const features = fullscreen 
      ? 'fullscreen=yes' 
      : `width=${width},height=${height},left=${(window.screen.width - width) / 2},top=${(window.screen.height - height) / 2}`;
    
    // Open the new window
    window.open(url, name, features);
  }, [width, height, fullscreen, name]);

  return openInNewWindow;
};

export default useWindowOpener;