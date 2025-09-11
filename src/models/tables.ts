export interface Table {
  id: string;
  name: string;
  columns: Column[];
  views: View[];
}

export interface Column {
  id: string;
  name: string;
  type: string;
}

export interface View {
  id: string;
  name: string;
}

export interface Row {
  id: string;
  [key: string]: any;
}