### Bug fix

**Be scientific: every shipped line traces to evidence.** A change that "might help" is a
hypothesis, not a fix. When the evidence refutes one, revert what it motivated.

A production escalation at work belongs to the `work-debug-escalation` skill instead, when it is
installed: stop and tell the user to run `/core:work-debug-escalation`, since it starts only
from them.

1. Reproduce it yourself on the surface where it was seen: the command, the request, the page. If
   it won't reproduce, tighten the conditions or instrument until it fires. Ask the user only
   with a specific reason you can't reach it.
2. Find the cause by elimination. List the hypotheses, seeded by the `how` skill over the area and
   the `why` skill for its history. Take the check that rules out the most, get runtime evidence,
   repeat. Add logging and read it as the code runs instead of guessing. When two fixes on one
   premise have failed, Attack the Premise.
3. Write the failing test first when there is a cheap local test path; otherwise keep the repro
   script.
4. Fix it where it first went wrong (Fix Root Causes), with the smallest change the evidence
   justifies, following the `code-style` skill.
5. Verify on the same surface: the original repro now passes. Inconclusive, or a different
   surface, is not a pass.
6. Look for the Same Problem Elsewhere.
7. Commit the failing test before the fix (Sequence Verifiable Units) with the `commit` skill.

**Reply:** what was broken, the root cause, the fix, and the failing-then-passing output pasted
verbatim.
