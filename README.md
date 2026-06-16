# int360 UXR Readout

Interactive shareout of the AI-Interview (modular 360) UX research — a single-scroll
narrative covering context, goals, personas, coverage, findings, and a raw research log,
across Candidate and Recruiter tracks.

Static site (HTML/CSS/vanilla JS). Published via GitHub Pages.

## Password protected

The research content is **AES-encrypted** (`js/app-data.enc.json`) and decrypted in the
browser only after the correct password is entered (PBKDF2 → AES-GCM, via the Web Crypto
API in `js/gate.js`). The plaintext data is **not** committed to this repo.

> Note: this is a client-side password layer for a public static site. Anyone given the
> password can view the content, and the URL itself is public. It is a deterrent /
> confidentiality layer, not enterprise access control.

## Run locally

```sh
node scripts/serve.mjs        # serves on http://localhost:8123
```

## Rotate / set the password

The encrypted blob is generated from local plaintext sources (`js/data.js`,
`js/v2content.js`, which are git-ignored):

```sh
node scripts/encrypt.mjs "<new-password>"   # regenerates js/app-data.enc.json
```

## Regenerate data from source sheets

```sh
python3 scripts/build_data.py   # rebuilds js/data.js from the exported sheets
node   scripts/encrypt.mjs "<password>"
```

## Structure

```
index.html            shell + password gate
css/styles.css         theme
js/gate.js             password gate (decrypts the data blob)
js/app.js              app: routing, sections, findings explorer
js/render.js           reusable render helpers
js/app-data.enc.json   AES-encrypted research data (committed)
scripts/encrypt.mjs    builds the encrypted blob
scripts/build_data.py  builds plaintext data from source sheets (local only)
scripts/serve.mjs      tiny static dev server
```
