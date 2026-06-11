export interface FieldConfig {
  id: string;
  name: string;
  fieldKey: string;
  fieldType: 'FIXED' | 'CUSTOM' | 'ROLE_EFFORT';
  dataType: 'TEXT' | 'LINK_TEXT' | 'NUMBER' | 'DATE' | 'MULTI_LINE';
  tapdField?: string | null;
  isVisible: boolean;
  isEditable: boolean;
  sortOrder: number;
  width?: number | null;
  teamConfigId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FieldConfigFormData {
  name: string;
  fieldKey: string;
  fieldType: FieldConfig['fieldType'];
  dataType: FieldConfig['dataType'];
  tapdField?: string;
  isEditable: boolean;
  sortOrder: number;
  width?: number;
}

export const FIELD_TYPE_OPTIONS = [
  { label: '固定字段', value: 'FIXED' },
  { label: '自定义字段', value: 'CUSTOM' },
  { label: '角色工时统计', value: 'ROLE_EFFORT' },
];

export const DATA_TYPE_OPTIONS = [
  { label: '文本', value: 'TEXT' },
  { label: '链接文本', value: 'LINK_TEXT' },
  { label: '数字', value: 'NUMBER' },
  { label: '日期', value: 'DATE' },
  { label: '多行文本', value: 'MULTI_LINE' },
];

export const FIELD_TYPE_COLORS: Record<string, string> = {
  FIXED: '#1677ff',
  CUSTOM: '#722ed1',
  ROLE_EFFORT: '#00b42a',
};

export const FIELD_TYPE_LABELS: Record<string, string> = {
  FIXED: '固定字段',
  CUSTOM: '自定义字段',
  ROLE_EFFORT: '角色工时统计',
};

export const DATA_TYPE_LABELS: Record<string, string> = {
  TEXT: '文本',
  LINK_TEXT: '链接文本',
  NUMBER: '数字',
  DATE: '日期',
  MULTI_LINE: '多行文本',
};
