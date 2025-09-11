import { BaseNextcloudClient } from './base';
import { Table, Row } from '../models/tables';

export class TablesClient extends BaseNextcloudClient {
  public async listTables(): Promise<Table[]> {
    return this.makeRequest<Table[]>({
      method: 'GET',
      url: '/apps/tables/api/v1/tables',
    });
  }

  public async getTable(tableId: string): Promise<Table> {
    return this.makeRequest<Table>({
      method: 'GET',
      url: `/apps/tables/api/v1/tables/${tableId}`,
    });
  }

  public async readTable(tableId: string): Promise<Row[]> {
    return this.makeRequest<Row[]>({
      method: 'GET',
      url: `/apps/tables/api/v1/tables/${tableId}/rows`,
    });
  }

  public async insertRow(tableId: string, row: Partial<Row>): Promise<Row> {
    return this.makeRequest<Row>({
      method: 'POST',
      url: `/apps/tables/api/v1/tables/${tableId}/rows`,
      data: row,
    });
  }

  public async updateRow(
    tableId: string,
    rowId: string,
    row: Partial<Row>
  ): Promise<Row> {
    return this.makeRequest<Row>({
      method: 'PUT',
      url: `/apps/tables/api/v1/tables/${tableId}/rows/${rowId}`,
      data: row,
    });
  }

  public async deleteRow(tableId: string, rowId: string): Promise<void> {
    await this.makeRequest<void>({
      method: 'DELETE',
      url: `/apps/tables/api/v1/tables/${tableId}/rows/${rowId}`,
    });
  }
}