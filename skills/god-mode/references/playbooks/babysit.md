### Babysit

1. Run the `babysit` skill on the PR. Its mode comes from the request: check, drive or threads.
2. When the request also asks to merge ("merge it once everything looks right", "land it"), run the
   `land` skill once babysit reports merge-ready. It verifies the PR independently and merges
   without asking again, unless `publish_approval` is `ask`.
3. Without a request to merge, stop at merge-ready; babysitting alone never merges.

**Reply:** babysit's report (where the PR stands, what was fixed or dismissed, what waits on the
user), plus land's verdict and merge commit when it ran.
