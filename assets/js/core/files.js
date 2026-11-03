/* Prototype-only image preparation; compressed data remains in the browser store. */
window.GT = window.GT || {};
window.GT.files = (function () {
  var MAX_BYTES = 300 * 1024;

  function dataUrlSize(dataUrl) {
    var base64 = String(dataUrl || '').split(',')[1] || '';
    return Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0));
  }

  function ensureWithinLimit(dataUrl) {
    if (dataUrlSize(dataUrl) > MAX_BYTES) throw new Error('The compressed photo is larger than 300 KB. Choose a smaller image.');
    return dataUrl;
  }

  function compressImage(file, maxSize) {
    return new Promise(function (resolve, reject) {
      if (!file || !String(file.type || '').startsWith('image/')) { reject(new Error('Choose an image file.')); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('The photo could not be read.')); };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () { reject(new Error('The selected image is not valid.')); };
        image.onload = function () {
          var limit = Number(maxSize) > 0 ? Number(maxSize) : 800;
          var scale = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          try { resolve(ensureWithinLimit(canvas.toDataURL('image/jpeg', 0.7))); }
          catch (error) { reject(error); }
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  return { MAX_BYTES: MAX_BYTES, dataUrlSize: dataUrlSize, ensureWithinLimit: ensureWithinLimit, compressImage: compressImage };
}());
