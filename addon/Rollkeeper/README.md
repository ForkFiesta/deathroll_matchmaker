# Rollkeeper 0.1.0 — experimental practice addon

This addon imports Last Roll practice terms, observes available system roll messages, and exports a client-supplied receipt. It does not transfer gold, verify payment, automate rolls, send chat/invites, track layers, move characters, or connect to the website.

## Compatibility

**Not yet tested in a WoW: Forever client.** `## Interface: 120000` is a conventional reference value, not a verified Forever interface version. In the target client, inspect `select(4, GetBuildInfo())` and update the `.toc` Interface field before testing. APIs, secondary-name formatting, and localized system messages may differ. Test with zero stakes first. The parser fails closed on unknown message formats, unexpected player names, or incorrect roll ranges.

## Install and use

1. Extract the `Rollkeeper` folder into the target game's `Interface/AddOns` folder. Check the interface number as described above. Restart the client and enable the addon.
2. Create a practice match on Last Roll and select **Export terms**. The ticket contains both player names and all terms. Sample partners cannot play in WoW; in-client testing requires two real players with tickets matching their exact system-message names.
3. Type `/rollkeeper` or `/rk`, paste the full ticket, and select **Import practice terms**. Both players should inspect the terms and agree before starting. Import does not prove either person's consent.
4. Players manually use the game's `/roll N`. Rollkeeper listens to `CHAT_MSG_SYSTEM` and the localized `RANDOM_ROLL_RESULT` format. It accepts only the expected player and range. No addon button performs a roll.
5. After someone rolls 1, select **Create practice receipt** and copy the receipt. Attach it to that match on the site if desired. The in-game observation is a separate practice run; attaching it does not overwrite website rolls, outcomes, or settlement confirmations.
6. `/rk reset` clears the local record. SavedVariables persist at reload/logout; the addon has no live internet transport.

Receipts can be edited by users. They are never Blizzard-certified proof of payment. No trade detection is implemented. The browser's practice confirmation is not proof that an in-game trade happened.

Source is visible and free under MIT. Blizzard can change or disable addon APIs. Read its UI Add-On Development Policy and deathroll advertising policy before distribution or use beyond private testing.
