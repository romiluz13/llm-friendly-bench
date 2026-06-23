export const SHAPES = ["shallow", "moderate", "deep"];

const META = {
  shallow: {
    id: "shallow",
    label: "Shallow",
    postgresTableCount: 8,
    normalization: "lightly normalized: workflow request + denormalized account/owner/signal columns",
    description: "Few tables (≈8); most state on the request row. Closest to a document."
  },
  moderate: {
    id: "moderate",
    label: "Moderate",
    postgresTableCount: 12,
    normalization: "1-to-many: accounts, contracts, owner-groups, risk-signals split into child tables",
    description: "Realistic CRUD normalization with several joins (≈12 tables)."
  },
  deep: {
    id: "deep",
    label: "Deep",
    postgresTableCount: 17,
    normalization: "full 3NF incl. a many-to-many junction; 10+ joins to reconstruct product state",
    description: "What a competent DBA builds for a mature system. Heavy reconstruction cost (≈17 tables, 10+ joins)."
  }
};

export function shapeMeta(shape) {
  const meta = META[shape];
  if (!meta) throw new Error(`Unknown shape: ${shape}`);
  return meta;
}
