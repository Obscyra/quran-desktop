# Releasing

Maintainer notes. Not needed to use or build the app.


Releases are built by GitHub Actions ([`release.yml`](../.github/workflows/release.yml)) when a version tag is pushed.

1. Write the release notes in `.github/release-notes/v<version>.md` (for example `v0.0.3-beta.md`). They are published above the install instructions in `.github/release-notes/footer.md`. Without a notes file the release only says "Release <tag>."
2. Commit and push to `main`.
3. Tag and push the tag:

   ```bash
   git tag -a v0.0.3-beta -m "Quran v0.0.3-beta"
   git push origin v0.0.3-beta
   ```

The workflow then builds the Windows installer (`.exe`) and the macOS disk image (`.dmg`), signs the update files, and publishes everything with `latest.json` as a GitHub release. The app version is taken from the tag, so the version fields in `package.json`, `tauri.conf.json` and `Cargo.toml` only matter for local builds. Releases are published as normal (non-pre-release) releases even for `-beta` tags, because installed apps look for updates in the repository's latest release.

## One-time setup for signed in-app updates

```bash
cd app && npx tauri signer generate -w ~/.tauri/quran-desktop.key
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/quran-desktop.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD   # leave empty if the key has no password
```

Put the printed public key in `app/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). Keep the private key safe: without it, installed copies can no longer be updated. Installed apps read `latest.json` from the repository's latest release, so the repository must be public.

## Bundled data

The installer carries the whole Arabic text and the 604 page fonts (about 120 MB, not in git). The release workflow downloads them with `node scripts/bundle-data.mjs` before building; for a local build run `npm run bundle` in `app/` first.
