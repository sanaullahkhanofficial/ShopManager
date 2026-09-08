# Verification checklist

## Static checks performed
- Electron main process syntax checked with `node --check electron/main.cjs`.
- Database schema and foreign-key declarations reviewed.
- Seed data argument count corrected.
- React purchase-cart JSX handlers corrected.

## Runtime checks to perform on Windows
1. `npm ci`
2. `npm run check`
3. `npm run build:web`
4. `npm run dev`
5. Login with `admin / admin123`.
6. Create category/product.
7. Create customer and supplier.
8. Create purchase and verify stock increases.
9. Create sale and verify stock decreases.
10. Test credit sale and customer payment.
11. Test supplier credit purchase and supplier payment.
12. Add expense and run date-range report.
13. Verify low-stock alert.
14. Run database integrity check.
15. Create a backup.
16. Change shop branding/settings.
17. Create a second user and test login.
18. `npm run dist` and install the generated Windows x64 NSIS installer.

## Known production boundary
The source is installer-ready, but an actual Windows `.exe` is not claimed as tested here because this Linux build environment cannot execute the Windows desktop installer. The included GitHub Actions workflow builds the installer on a Windows runner.
