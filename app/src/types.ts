// Data saved on the phone (IndexedDB "ghar-hisaab", version 2). Keep these shapes backward compatible:
// old backups and old phones must keep opening.

export type Kind = "construction" | "documents";
export type View = "all" | Kind;

export interface FileRef { key: string; name: string; type: string; size: number }
export interface OtherPerson { contactId: string; role?: string }

export interface Entry {
  id: string;
  projectId: string;
  ts: number;
  item: string | null;
  itemName?: string;
  qty: number | null;
  unit: string | null;
  rate: number | null;
  amount: number;
  cash: number;
  online: number;
  vendor: string;
  contactId: string | null;
  note: string;
  slipKey: string | null;
  files?: FileRef[];
  others?: OtherPerson[];
  dealId?: string;
  /** set when made while Construction or Documents was picked at the top and no item says otherwise */
  kind?: Kind;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Contact { id: string; name: string; phone: string; createdAt: number; updatedAt: number }
export interface Project { id: string; name: string; createdAt: number }
export interface Item { k: string; n: string; sub: string; cat: string; units: string[]; hidden?: boolean }
export interface Group { k: string; n: string; kind: Kind | null }

export interface DealField { label: string; value: string; mul?: boolean }
export type DealType = "calc" | "fixed" | "monthly";

export interface Deal {
  id: string;
  projectId: string;
  contactId?: string;
  item?: string | null;
  title: string;
  type: DealType;
  fields: DealField[];
  /** fixed: agreed total. monthly: salary per month. */
  amount?: number;
  /** monthly: first working day, YYYY-MM-DD */
  start?: string;
  /** monthly: last working day, YYYY-MM-DD */
  end?: string;
  deadline?: string;
  note?: string;
  closed?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

/** The parts of a deal that decide its numbers (also used for the half-filled deal form). */
export type DealTerms = Pick<Deal, "type" | "fields" | "amount" | "start" | "end" | "deadline">;

/** Deal shapes saved by older versions (v2.4 – v2.8). normDeal() upgrades them. */
export interface LegacyDeal extends Omit<Deal, "type" | "fields"> {
  type?: DealType | "rate";
  fields?: DealField[];
  rate?: number | string | null;
  qty?: number | string | null;
  unit?: string;
  terms?: { label?: string; value?: string }[];
}
