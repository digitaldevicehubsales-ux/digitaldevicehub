# DigitalDeviceHub v3 deployment package

Contains the site-v3 ZIP files (the homepage-v3 ZIP duplicates the same homepage assets) and an apply script to merge changes into your existing GitHub repository without removing marketplace listing rendering.

1. Make a local clone or copy of `digitaldevicehubsales-ux/digitaldevicehub`.
2. Preview: `python apply_v3.py /path/to/digitaldevicehub --dry-run`
3. Apply: `python apply_v3.py /path/to/digitaldevicehub`
4. Inspect the diff, verify site functionality, commit and push to `main` if your deployment provider is connected to this repository.

The script backs up replaced files, adds the global theme to existing root HTML pages already using `premium-ui.css`, removes the specified `apple-motion.js` tag, and increments the service worker cache revision. Do not upload the script or README to the web root. No Supabase changes are required.
