# Measure the Number

Apply when a request rests on a quantity: a size, a limit, a count, a duration, a cost. Find its real value and the real limit it runs into before you choose a fix, and measure again after the change.

A fix aimed at an estimated number can be too small, too big, or aimed at the wrong thing.

- **Find the limit, not just the value.** "Too big" means nothing until you know what it is too big for. Read the threshold from the code, the config or the tool that enforces it.
- **Measure the before.** Run the real code path on real data. When there is no real data, build a fixture sized to the numbers you were given and measure that.
- **Measure the after, the same way.** Same code path, same data or fixture. Report both numbers and the limit together.
- **Keep the measurement rerunnable.** A small script or test that prints the number beats a one-off reading; say where it lives.
- When you are about to trust or report a number you measured, apply [Explain the Number](explain-the-number.md) too.
