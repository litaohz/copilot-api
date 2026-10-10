# FSD operations dashboard

`index.html` is the exact static page served at `/dash` when this repository
was consolidated on 2026-10-10. It uses the proxy's authenticated `/admin/stats`
API and stores the entered token in the browser. No token is embedded here.

Production currently serves a copy at `/var/www/edge-dash/index.html`.
After editing this page, publish that file deliberately and verify it with:

```sh
python3 deployment/verify.py --git --deployed-dashboard /var/www/edge-dash/index.html
```

The page originated in `litaohz/edge-proxy-dashboard` (MIT). The production
variant retains its FSD title and fixed origin; the older repository's generic
`?base=` variant is not silently substituted during consolidation.

Authentication, statistics and Responses compatibility belong in `src/`.
Do not add proxy runtime patches to this directory.
