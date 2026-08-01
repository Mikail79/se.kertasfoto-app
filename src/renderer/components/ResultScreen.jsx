import React from 'react';

export default function ResultScreen({ 
  driveResult, 
  driveError, 
  retryCount, 
  isRetrying, 
  onRetry,
  onNext 
}) {
  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', 
      justifyContent: 'center', height: '100%', padding: '24px', 
      textAlign: 'center', background: 'var(--color-bg-elevated)',
      borderRadius: '12px'
    }}>
      
      {/* KONDISI 4: UPLOAD BERHASIL */}
      {driveResult ? (
        <div className="success-state">
          <h2 style={{ color: '#4ade80', marginBottom: '16px' }}>✅ Upload Berhasil!</h2>
          
          {driveResult.webViewLink && (
            <div style={{ 
              background: '#fff', padding: '16px', borderRadius: '8px', 
              display: 'inline-block', marginBottom: '16px' 
            }}>
              {/* Tempatkan render Image/Canvas QR Code Anda di sini berdasarkan driveResult.webViewLink */}
              <div style={{ width: 150, height: 150, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#000', fontSize: '12px' }}>[ QR Code Render ]</span>
              </div>
            </div>
          )}
          
          <p style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>Scan untuk download</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            <span>☁️ Tersimpan di Drive</span>
            <span>💾 Tersimpan lokal</span>
          </div>

          <button onClick={onNext} className="btn btn-primary" style={{ marginTop: '24px' }}>
            Selesai
          </button>
        </div>

      ) : (
        /* KONDISI 1, 2, 3: UPLOAD GAGAL ATAU SEDANG RETRY */
        <div className="error-state">
          
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', 
            padding: '24px', borderRadius: '8px', marginBottom: '24px'
          }}>
            <h3 style={{ color: '#ef4444', marginBottom: '8px' }}>
              {isRetrying ? `⏳ Percobaan ${retryCount}/3...` : '⚠️ Upload Bermasalah'}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
              {driveError}
            </p>
          </div>

          {/* KONDISI 2: TAMPILAN LOADING SAAT PROSES MENGULANG */}
          {isRetrying ? (
             <button disabled className="btn" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
               <span className="spinner" style={{ marginRight: '8px' }}>⏳</span> Mengulang Upload...
             </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              
              {/* KONDISI 1: TOMBOL RETRY (Jika belum menyentuh batas maksimal 3 kali) */}
              {retryCount < 3 ? (
                <button onClick={onRetry} className="btn btn-warning" style={{ background: '#f59e0b', color: '#fff' }}>
                  🔄 Coba Lagi ({retryCount}/3)
                </button>
              ) : null}

              {/* KONDISI 3: BATAS RETRY HABIS (Munculkan opsi lanjut/lewati) */}
              <button onClick={onNext} className="btn btn-primary" style={{ marginTop: '12px' }}>
                ▶ Lewati & Lanjut ke Sesi Berikutnya
              </button>
              
            </div>
          )}

          <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            💾 Tenang, foto tetap tersimpan secara lokal.
          </p>
        </div>
      )}
    </div>
  );
}