# MB-596 product journey metrics

The ADMIN dashboard now reads the backend-owned `product-journey-metrics-v1` projection through an authenticated same-origin BFF. An administrator can select 7, 30, or 90 days and refresh the current window. Loading, complete, partial-source, unsupported-fact, dependency-error, and retry states are explicit; stale counts are cleared after a failed refresh.

The UI renders only aggregate counts and the rates supplied by the authoritative contract. It does not calculate clinical or recovery outcomes, does not turn unavailable sources into zero, and describes the projection as product activity rather than effectiveness or causation. Source versions and as-of instants are available under the collapsed technical disclosure.

Focused component and BFF tests cover explicit window forwarding, ADMIN authentication, unavailable-source presentation, unsupported Support Guide usage, stale-data clearing, and removal of the previous hard-coded journey values. The frontend Identity contract snapshot and generated TypeScript types are synchronized with the backend OpenAPI source.
