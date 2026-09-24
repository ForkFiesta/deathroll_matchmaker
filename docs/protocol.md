# Rollkeeper copy/paste protocol v1

The wire format is plain text, not executable Lua. Maximum ticket length is 1,400 characters. Strings are lowercase UTF-8 hex, avoiding separator injection and Lua evaluation. There is no shared secret, signature, or authenticity guarantee.

## Terms ticket

```text
RK1|match UUID|practice|region|ruleset|faction|stake|starting maximum|first player index|player 1 hex|player 2 hex|meeting place hex|created Unix seconds
```

There must be exactly 13 fields. Region is `US` or `EU`; ruleset is `Normal`, `PvP`, or `Hardcore`; faction is `Alliance` or `Horde`. Stake is an integer from 1 to 1,000 in valueless practice units. First-player index is `1` or `2`. The addon accepts starting maximums from 2 to 1,000,000; this website emits 1,000. Hex fields reject control characters, empty values, odd lengths, and oversized inputs. Player names must be distinct.

IDs associate receipts with website matches; they do not grant access. A session cookie is required to read, attach evidence to, or mutate a match, and the session must belong to a participant.

## Observed practice receipt

```text
RKR1|match UUID|practice|player1 or player2|observed Unix seconds
```

The fourth field identifies the losing player. The addon emits a receipt only after an observed valid roll of 1. The API also accepts `unknown` for manually supplied inconclusive evidence. The website validates the structure and match association and stores the attachment with the uploader and import time. It never accepts it as proof of outcome or payment.

Receipts contain no actual trade information. They can be edited, fabricated, or replayed by a participant. They are not signed by Blizzard. Importing one does not alter match state, server rolls, losses, or settlement confirmations. Only the most recent attachment is retained in this prototype.
