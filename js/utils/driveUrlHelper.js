/* ==========================================================================
   UTILIDADES DE URL (GOOGLE DRIVE, DROPBOX, GITHUB RAW)
   ========================================================================== */

export const DriveUrlHelper = {
  toDirectImageUrl(raw) {
    const url = String(raw || '').trim();
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const matchFile = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFile && matchFile[1]) {
      return `https://lh3.googleusercontent.com/d/${matchFile[1]}`;
    }
    const matchOpen = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchOpen && matchOpen[1] && url.includes('drive.google.com')) {
      return `https://lh3.googleusercontent.com/d/${matchOpen[1]}`;
    }
    return url;
  },

  toEmbedFolderUrl(raw) {
    const url = String(raw || '').trim();
    const matchFolder = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (matchFolder && matchFolder[1]) {
      return `https://drive.google.com/embeddedfolderview?id=${matchFolder[1]}#grid`;
    }
    return url;
  },

  toDirectCartridgeUrl(raw) {
    const url = String(raw || '').trim();
    if (!url) return '';
    if (url.includes('dropbox.com')) {
      return url
        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        .replace(/[?&]dl=0/, (m) => (m.startsWith('?') ? '?dl=1' : '&dl=1'));
    }
    if (url.includes('github.com') && url.includes('/blob/')) {
      return url
        .replace('https://github.com/', 'https://raw.githubusercontent.com/')
        .replace('/blob/', '/');
    }
    return url;
  }
};
