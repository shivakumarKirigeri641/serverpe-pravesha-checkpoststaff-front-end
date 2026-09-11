# Pravesha Checkpost

The staff app used at the gate. A visitor books a vehicle entry pass on WhatsApp
and is told they need do nothing at the checkpost — staff look the vehicle up
here and record the entry, and the visitor gets a WhatsApp confirmation the
moment they do.

One screen does the work: type the plate (the last four digits are enough),
tap the pass, press the button. Today's expected vehicles are listed underneath
for anyone who would rather find the visitor than type.

## Running it

```bash
npm install
npm run dev          # http://localhost:5190, proxies /staff to the back-end
```

The back-end must be running on `http://localhost:5005` (or set
`VITE_PROXY_TARGET`). Staff and PINs are issued from the back-end repo:

```bash
node scripts/staff.js checkposts                  # list gates and their ids
node scripts/staff.js add "Ramesh K" 9886122415 1  # prints the PIN once
node scripts/staff.js reset 9886122415             # new PIN, clears any lock
```

## Building for the gate

```bash
VITE_API_BASE=https://api.pravesha.in npm run build
```

`dist/` is static. Serve it from its own host (for example
`https://checkpost.pravesha.in`) with the usual single-page fallback. The app is
`noindex` and installs to a phone's home screen as a standalone app.

## How it behaves

- **A shift, not a login.** Signing in opens a shift; one live shift per person
  and per checkpost, so signing in elsewhere ends the previous one and that
  handover is recorded. A shift left idle expires and the app returns to
  sign-in by itself.
- **Three answers, in three colours.** Green means record it, red means stop,
  amber means the staff member is being asked — a vehicle outside its time slot
  can be allowed, and the entry is then stored as an override with their name on
  it.
- **Nothing is recorded until the button is pressed.** Opening a pass only asks
  for its verdict.
- **A double tap cannot double-enter.** A pass becomes 'used' once; the second
  attempt is told when the first happened.
- **A lost signal is never a verdict.** A request that does not reach the server
  is reported as a network problem, never as "no such pass".

Pravesha is a product of ServerPe App Solutions.
