/**
 * Pengecekan status koneksi internet perangkat
 */
export const checkConnection = () => {
    return navigator.onLine;
  };
  
  /**
   * Algoritma Exponential Backoff
   * Menghitung waktu tunggu: 1s -> 2s -> 4s (Maksimal 30 detik)
   */
  export const calculateBackoff = (attempt) => {
    const baseDelay = 1000;
    const multiplier = 2;
    const maxDelay = 30000;
    return Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay);
  };
  
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  
  /**
   * Logika utama untuk menjalankan dan mengulang upload
   */
  export const retryableUpload = async (uploadFunc, dataUrl, folderId, filename, attempt = 1) => {
    if (!checkConnection()) {
      throw new Error('Tidak ada koneksi internet. Pastikan perangkat terhubung ke jaringan.');
    }
  
    try {
      const result = await uploadFunc(dataUrl, folderId, filename);
      if (!result || !result.success) {
        throw new Error(result?.error || 'Upload gagal tanpa respon dari server');
      }
      return result;
    } catch (error) {
      if (attempt >= 3) {
        throw new Error('Upload gagal setelah 3 percobaan');
      }
      // Tunggu sesuai algoritma backoff sebelum melempar error untuk ditangkap UI
      const waitTime = calculateBackoff(attempt);
      await delay(waitTime);
      throw error;
    }
  };
  
  /**
   * Memastikan data gambar diubah menjadi format base64 agar aman disimpan di localStorage
   */
  const toBase64 = (data) => {
    return new Promise((resolve, reject) => {
      if (typeof data === 'string') return resolve(data);
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(data);
    });
  };
  
  /**
   * Simpan state retry (termasuk gambar dan metadata) ke localStorage
   */
  export const storeRetryState = async (eventId, retryData) => {
    try {
      const base64Img = await toBase64(retryData.compositeImg);
      const dataToStore = {
        ...retryData,
        compositeImg: base64Img,
        storedAt: new Date().toISOString(),
        eventId
      };
      localStorage.setItem(`retry_${eventId}`, JSON.stringify(dataToStore));
    } catch (err) {
      console.error('Gagal menyimpan data retry ke lokal:', err);
    }
  };
  
  /**
   * Ambil data retry dari localStorage (Auto-cleanup jika data lebih dari 1 jam)
   */
  export const retrieveRetryState = (eventId) => {
    try {
      const data = localStorage.getItem(`retry_${eventId}`);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      const storedTime = new Date(parsed.storedAt).getTime();
      const now = new Date().getTime();
      
      if (now - storedTime > 3600000) {
        localStorage.removeItem(`retry_${eventId}`);
        return null;
      }
      return parsed;
    } catch (err) {
      return null;
    }
  };
  
  /**
   * Bersihkan data retry jika proses berhasil atau pengguna membatalkan
   */
  export const clearRetryState = (eventId) => {
    localStorage.removeItem(`retry_${eventId}`);
  };