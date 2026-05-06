; se.kertasfoto — Custom NSIS installer script
; Chained installer: checks for digiCamControl and offers to install it

!macro customInstall
  ; Check if digiCamControl is already installed
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\digiCamControl" "InstallLocation"
  StrCmp $0 "" 0 +3
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\digiCamControl" "InstallLocation"
  StrCmp $0 "" askInstallDCC dccFound

  askInstallDCC:
    ; digiCamControl not found — ask user
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "Untuk mengontrol kamera DSLR secara penuh (ISO, Shutter Speed, Aperture, Flash), diperlukan digiCamControl.$\n$\nApakah Anda ingin membuka halaman download digiCamControl sekarang?$\n$\n(Anda bisa melewati ini jika hanya menggunakan webcam)" \
      IDYES openDCCDownload IDNO skipDCC

  openDCCDownload:
    ExecShell "open" "https://digicamcontrol.com/download"
    MessageBox MB_OK|MB_ICONINFORMATION \
      "Silakan download dan install digiCamControl.$\nSetelah selesai, buka se.kertasfoto dan hubungkan kamera DSLR Anda via USB."
    Goto skipDCC

  dccFound:
    ; digiCamControl already installed, do nothing
    DetailPrint "digiCamControl sudah terinstall di: $0"

  skipDCC:
!macroend

!macro customUnInstall
  ; Nothing special needed for uninstall
!macroend
