# Use generated scenario datasets

The first proof scenarios will use immutable generated Scenario Datasets rather than throwaway mocks or customer-derived data. This preserves credibility for sellers and customers while avoiding privacy, legal, and security drag; both MongoDB and Postgres versions of a scenario must be seeded from the same canonical dataset version and exercised in real local services before a replay is verified.
