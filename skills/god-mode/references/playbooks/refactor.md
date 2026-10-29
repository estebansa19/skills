### Refactor

**The structure changes. The behavior does not.** A missing feature or a real bug found on the
way is split out into its own change, not slipped in.

1. Pin the behavior first. Run the `how` skill over the area to learn its contract, then write a
   characterization test, snapshot or before/after script that captures what it does today. A
   typecheck and a lint pass are not a pin.
2. Name the structure the code is missing (Model the Domain) and the shape you would build today
   (Redesign from First Principles). Boring code that is already clear stays.
3. Subtract Before You Add: delete dead code and one-caller wrappers first.
4. Move in small steps, each keeping the pin green. For an API reshape, migrate every caller and
   delete the old API in the same wave, with no shims. Check every rename against the code,
   strings and docs.
5. Prove It Works: the behavior is unchanged on the real artifact. For a large reshape, diff old
   and new outputs with a script (Build the Lever).
6. Keep it only if reader load drops somewhere (Minimize Reader Load); otherwise revert it.
7. Commit in order with the `commit` skill: the subtraction, then the reshape, then any cleanup.

**Reply:** the structure that changed, the pin, the proof it behaves the same, where reader load
dropped, and anything reverted. No new behavior.
