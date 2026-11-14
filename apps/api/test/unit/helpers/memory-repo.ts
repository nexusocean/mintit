import { FindOperator } from 'typeorm';

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function matchValue(actual: unknown, expected: unknown): boolean {
  if (expected instanceof FindOperator) {
    const v = expected.value as unknown;
    switch (expected.type) {
      case 'in':
        return (v as unknown[]).includes(actual);
      case 'lessThanOrEqual':
        return (actual as number | Date) <= (v as number | Date);
      case 'isNull':
        return actual === null || actual === undefined;
      default:
        throw new Error(`MemoryRepo: unsupported operator ${expected.type}`);
    }
  }
  return actual === expected;
}

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([k, v]) => matchValue(row[k], v));
}

/**
 * Just enough of a TypeORM Repository for services that use find/findOne/
 * insert/update/save with plain or In/LessThanOrEqual/IsNull criteria.
 * `uniqueBy` mimics a unique index: a duplicate insert throws Postgres 23505.
 */
export class MemoryRepo<T extends Row> {
  rows: T[] = [];

  constructor(private readonly uniqueBy?: (keyof T)[]) {}

  find = jest.fn(async (opts: { where?: Where } = {}): Promise<T[]> =>
    this.rows.filter((r) => matches(r, opts.where)).map((r) => ({ ...r })),
  );

  findOne = jest.fn(async (opts: { where?: Where }): Promise<T | null> => {
    const row = this.rows.find((r) => matches(r, opts.where));
    return row ? { ...row } : null;
  });

  insert = jest.fn(async (row: Partial<T>) => {
    if (this.uniqueBy) {
      const dup = this.rows.some((r) =>
        this.uniqueBy!.every((k) => r[k] === row[k]),
      );
      if (dup) throw Object.assign(new Error('duplicate'), { code: '23505' });
    }
    this.rows.push({ ...row } as T);
    return { identifiers: [] };
  });

  update = jest.fn(async (where: Where, set: Partial<T>) => {
    let affected = 0;
    for (const r of this.rows) {
      if (matches(r, where)) {
        Object.assign(r, set);
        affected++;
      }
    }
    return { affected };
  });

  create = jest.fn((data: Partial<T>) => ({ ...data }) as T);

  save = jest.fn(async (data: T) => {
    const i = this.rows.findIndex(
      (r) => r.id !== undefined && r.id === data.id,
    );
    if (i >= 0) this.rows[i] = { ...data };
    else this.rows.push({ ...data });
    return data;
  });
}
