export function downloadImage(url: string, filename = 'image.png') {
  const params = new URLSearchParams({ url, filename });
  triggerDownload(`/api/download?${params.toString()}`, filename);
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
