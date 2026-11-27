# Jidi Bio / Jidi Peptides

Static research peptide catalog for **Shandong Jidi Biotechnology Co., Ltd.**

- Canonical domain: **https://jidi.com**
- Publish mode: static HTML, no build step
- Repository root is the Cloudflare Pages output directory
- 56 product pages / 148 pack configurations
- RP-HPLC, ESI-MS and lot-specific COA documentation
- **For Laboratory Research and Manufacturing Use Only. Not for Human or Veterinary Use.**

## Cloudflare Pages

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Select `PolymerGroup/jidi`.
3. Framework preset: **None**.
4. Build command: leave empty.
5. Build output directory: **`/`**.
6. Deploy, then add the custom domain `jidi.com` and redirect `www.jidi.com` to `jidi.com`.
7. Use SSL/TLS **Full (strict)** and enable **Always Use HTTPS**.

## Verify after deployment

- `https://jidi.com/`
- `https://jidi.com/products/`
- `https://jidi.com/products/bpc-157.html`
- `https://jidi.com/sitemap.xml`
- `https://jidi.com/robots.txt`
- `https://jidi.com/llms.txt`

## Search engines and AI crawlers

- Submit `https://jidi.com/sitemap.xml` to Google Search Console and Bing Webmaster Tools.
- `robots.txt` allows GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended and CCBot.
- `llms.txt` is the site and product entity index for generative answer engines.

## Notes

- All canonical, sitemap and JSON-LD URLs use `https://jidi.com`.
- Analytical traces shown on product pages are representative method illustrations; the lot-specific COA contains the actual results.
- Blends and sequence-defined factors without a single public CAS are labelled accordingly.
