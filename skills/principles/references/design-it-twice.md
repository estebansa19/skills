# Design It Twice

Apply when a change has more than one reasonable shape: an API or data shape, where state lives, how a caller gets what it needs, a new interaction with no precedent in the codebase. Write down at least two whole designs, with how each would fail, before building one.

The first design that works is rarely compared with anything, so its weaknesses go unseen until they ship.

- **Whole shapes, not tweaks.** Two candidates that differ in one parameter are one design. Vary the structure: who owns the data, which side does the work, what the caller sees.
- **Give each one its failure.** Name the input, load or future change that breaks it, with a number when there is one ("an opt-in flag overflows again at about 15 rows"). A design with no named failure has not been examined.
- **Prefer the smaller surface.** Between viable designs, take the one that hides more behind a simpler interface, and the one where a change that looks right from one file is right for the whole system.
- **Settle it by running when you can.** When the deciding question is empirical (feel, layout, speed), build two throwaway prototypes and compare them side by side instead of arguing.
- **Report the rejected designs** in a line each, with the failure that ruled them out.
