import { Table, Row } from '../models/tables';
import { TablesClient } from '../client/tables';
import { getClient } from '../app';

export async function nc_tables_list_tables(): Promise<Table[]> {
  return getClient(TablesClient).listTables();
}

export async function nc_tables_get_schema(tableId: string): Promise<Table> {
  return getClient(TablesClient).getTable(tableId);
}

export async function nc_tables_read_table(tableId: string): Promise<Row[]> {
  return getClient(TablesClient).readTable(tableId);
}

export async function nc_tables_insert_row(
  tableId: string,
  row: Partial<Row>
): Promise<Row> {
  return getClient(TablesClient).insertRow(tableId, row);
}

export async function nc_tables_update_row(
  tableId: string,
  rowId: string,
  row: Partial<Row>
): Promise<Row> {
  return getClient(TablesClient).updateRow(tableId, rowId, row);
}

export async function nc_tables_delete_row(
  tableId: string,
  rowId: string
): Promise<void> {
  await getClient(TablesClient).deleteRow(tableId, rowId);
}