# Demo brief (holdout test against job 6427)

Paste this into **New Estimate** once Phase 3 is deployed. It describes Mount Pritchard East PS in plain
estimator language; the draft it produces is compared against the real 6427 quote ($31,993.40 ex GST).

> School hall upgrade, Mount Pritchard East PS. Replace the old projector with a ~6,500 lm laser projector
> on a new ceiling pole; keep the existing motorised screen and add relay control. Two HDMI inputs, one at
> the stage and one at the rack, with auto-switching. Keep the existing speakers and amps. New DSP,
> 3 wireless mics (2 handheld + 1 wireless lectern gooseneck) with remote antennas, Bluetooth input in the
> rack. Small touch panel in the rack for control. Reuse the existing rack. Split pricing into Video /
> Audio / Control so the school can stage it. EWP needed. Remove DVD/CD players.

## Testing the upload flow now
Use a real proposal on `/upload`. The demo plan suggests re-uploading the 6521 PDF live: the review screen
should show the arithmetic check reconciling to $69,185.90. Do not upload 6427 through the normal flow
until Phase 4; when you do, tick **holdout** on the review screen so it stays out of matching.
