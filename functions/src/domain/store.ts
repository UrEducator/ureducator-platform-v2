/** Minimal persistence port. Firestore implements it in production; an in-memory version is used in tests. */
export type Where = [field: string, op: '==' | '>=' | '<=' | '>' | '<' | 'in', value: unknown];
export type ListOpts = { where?: Where[]; orderBy?: string; desc?: boolean; limit: number; startAfter?: string };
export type Row<T> = { id: string; data: T };

export interface TxStore {
  get<T>(path: string): Promise<T | null>;
  set(path: string, data: object): void;
  /** merge into an existing or new document (deep merge of maps, arrays replaced) */
  merge(path: string, data: object): void;
  create(path: string, data: object): void; // fails if it exists
}
export interface Store {
  get<T>(path: string): Promise<T | null>;
  set(path: string, data: object): Promise<void>;
  merge(path: string, data: object): Promise<void>;
  list<T>(collection: string, opts: ListOpts): Promise<Row<T>[]>;
  count(collection: string, where: Where[]): Promise<number>;
  delete(path: string): Promise<void>;
  transact<T>(fn: (tx: TxStore) => Promise<T>): Promise<T>;
}
