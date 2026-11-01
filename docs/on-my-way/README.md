# "On my way" with ETA (approved design, not built yet)

Preview: https://claude.ai/artifact/Bfy2jbKPQU9q3hXbXzPy6C. `mockup.html` is the standalone copy.

- New `visits` table (project_id, starts_at, ends_at, note, status) and an "Add a visit" form for the contractor.
- Button window: 20 minutes before the start to 20 minutes after.
- One browser geolocation check on tap (not stored). Server computes ETA (straight-line at an average speed, or a routing API such as Google or Mapbox with its own key) and sends "about N minutes" to the homeowner by in-app, email and text alert. No map, no live tracking.
- "I have arrived" closes the visit. Mention in the privacy policy.
