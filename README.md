# Megagem: Playroom Proof of Concept

A browser version of Jane Street's Megagem, with a shared host board and a phone-friendly player view. The live version uses Playroom Kit rooms and a sample table with simulated opponents can be opened without an account.

## Run it

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and set `VITE_PLAYROOM_GAME_ID` using a game ID from the [Playroom developer portal](https://dev.joinplayroom.com/).
3. Start the app with `npm run dev`.
4. Host a table, then share its QR code and room code. The QR code opens Megagem; players enter the room code to join. Join from 3 to 5 player devices and start once everyone is in. The host runs the board and does not take a game seat.

Select **Explore a sample table** on the opening screen to try the host board without configuring Playroom. The sample bidders and their bids are simulated.

## Included rules

- 3–5 players, with the published starting coins and information-hand sizes.
- Shuffled gem, auction, and mission decks; two visible gems; gem, auction, and mission-card counts scale across 3-, 4-, and 5-player tables.
- Sealed simultaneous bids, loan-backed bidding, investments, loans, and gem lots.
- A winner reveals one information gem after each auction; gem purchases can claim any completed open missions.
- Revealed-color counts during play; the scoring chart and per-gem values are shown only in the host's final scoring view using Value Chart A.
- Aggregate market and player stats on the host display; player devices focus on their own hand and auction actions.

Room-code joins that land the caller in a newly created empty room are rejected. For this proof of concept, first-auction ties break in player-list order; later ties break clockwise from the most recent winner. Only Chart A is implemented; the published rules' alternate value charts are not included.

## State and trust

The public board is stored in Playroom multiplayer state. Hands and sealed bids are kept out of other players' screens, but Playroom Kit synchronizes player state to clients; a determined player can inspect it. This is suitable for trying the interaction model, not for a stakes-bearing or cheat-resistant game. A production version should move private hands and bid validation to a trusted server or private per-player transport.

## Checks

- `npm test` runs the rules-engine tests.
- `npm run build` creates the production bundle.


Install notes:

This is a static Vite app, so Cloudflare Pages can host it directly.

1. Push the repo to GitHub or GitLab, then in Cloudflare go to **Workers & Pages → Create application → Pages → Connect to Git**.
2. Select the repo and set:
   - **Production branch:** `main`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (the default)
3. In the Pages project’s **Settings → Environment variables**, add `VITE_PLAYROOM_GAME_ID` for both Production and Preview. Get its value from the Playroom developer portal. The sample table works without it, but live rooms need it.
4. Deploy. Cloudflare will give you a `*.pages.dev` URL; you can add a custom domain in the project’s **Custom domains** settings.

You can also test the production build locally with `npm ci && npm run build`; Vite writes the deployable files to `dist`. Note that `VITE_` variables are included in the browser bundle, so only use it for the Playroom game ID, not a secret.
